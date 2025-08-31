from typing import List, Dict, Iterable
import os
import re
import math
import time
from pathlib import Path
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import PointStruct, Distance, VectorParams, PayloadSchemaType
import tiktoken
import uuid
from app.core.config import settings
from datetime import datetime
import tempfile
import logging
import numpy as np
import google.generativeai as genai

logger = logging.getLogger("rag.ingest")

# Configure the Gemini client
try:
    genai.configure(api_key=settings.google_api_key)
except Exception as e:
    logger.error("Failed to configure Gemini client: %s", e)

ENC = tiktoken.get_encoding("cl100k_base")  # token counting


def _read_text_from_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        texts = []
        for p in reader.pages:
            texts.append(p.extract_text() or "")
        return "\n".join(texts)
    elif suffix in {".md", ".txt"}:
        return path.read_text(encoding="utf-8")
    else:
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return ""


def _token_len(text: str) -> int:
    return len(ENC.encode(text))


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 64) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = []
    current_tokens = 0
    for sent in sentences:
        sent_tokens = _token_len(sent)
        if current_tokens + sent_tokens <= chunk_size:
            current.append(sent)
            current_tokens += sent_tokens
        else:
            if current:
                chunks.append(" ".join(current).strip())
            if sent_tokens > chunk_size:
                start = 0
                enc = ENC.encode(sent)
                while start < len(enc):
                    piece_enc = enc[start:start + chunk_size]
                    piece = ENC.decode(piece_enc)
                    chunks.append(piece.strip())
                    start += chunk_size - overlap
                current = []
                current_tokens = 0
            else:
                current = [sent]
                current_tokens = sent_tokens
    if current:
        chunks.append(" ".join(current).strip())
    return chunks


def embed_texts(texts: Iterable[str]) -> List[List[float]]:
    """Generates and normalizes embeddings for a list of texts using the Gemini API."""
    text_list = [t for t in texts if t.strip()]
    if not text_list:
        return []

    all_embeddings = []
    batch_size = 100
    for i in range(0, len(text_list), batch_size):
        batch = text_list[i:i+batch_size]
        try:
            result = genai.embed_content(
                model=settings.gemini_embedding_model,
                content=batch,
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=settings.gemini_embedding_dimensionality
            )
            raw_embeddings = result['embedding']
            
            # **CRITICAL STEP**: Normalize embeddings for accurate similarity search
            for emb in raw_embeddings:
                emb_np = np.array(emb)
                norm = np.linalg.norm(emb_np)
                if norm > 0:
                    all_embeddings.append((emb_np / norm).tolist())
                else:
                    # Append a zero vector if norm is zero
                    all_embeddings.append([0.0] * settings.gemini_embedding_dimensionality)

        except Exception as e:
            logger.error(f"Gemini embedding failed for a batch. Error: {e}")
            num_failed = len(batch)
            all_embeddings.extend([[0.0] * settings.gemini_embedding_dimensionality] * num_failed)
            time.sleep(1) # Simple backoff

    return all_embeddings


def _get_qdrant_client(prefer_grpc: bool = False) -> QdrantClient:
    return QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=prefer_grpc)


def upsert_documents(paths: List[str],
                     collection_name: str,
                     chunk_size: int = settings.chunk_token_size,
                     overlap: int = settings.chunk_overlap,
                     metadata_overrides: Dict = None) -> Dict[str, int]:
    client = _get_qdrant_client(prefer_grpc=False)
    dim = settings.gemini_embedding_dimensionality

    try:
        client.get_collection(collection_name)
    except Exception:
        client.recreate_collection(
            collection_name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
        )

    client.create_payload_index(
        collection_name=collection_name,
        field_name="file_name",
        field_schema=PayloadSchemaType.KEYWORD,
        wait=True
    )

    uploaded = 0
    for path_str in paths:
        p = Path(path_str)
        if not p.exists():
            continue
        text = _read_text_from_file(p)
        chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        if not chunks:
            continue

        embeddings = embed_texts(chunks)
        points = []
        for idx, (chunk, vec) in enumerate(zip(chunks, embeddings)):
            chunk_id = str(uuid.uuid4())
            payload = {
                "source": p.name, "file_name": p.name,
                "chunk_index": idx, "text": chunk,
            }
            if metadata_overrides:
                payload.update(metadata_overrides)
            points.append(PointStruct(id=chunk_id, vector=vec, payload=payload))

        if points:
            client.upsert(collection_name=collection_name, points=points)
            uploaded += len(points)
        
    return {"upserted_chunks": uploaded}


def upsert_file_bytes(file_bytes: bytes,
                      filename: str,
                      email: str,
                      collection_name: str,
                      chunk_size: int = settings.chunk_token_size,
                      overlap: int = settings.chunk_overlap) -> Dict[str, int]:
    suffix = Path(filename).suffix or ".txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        tmp_path = Path(tmp.name)

    try:
        metadata_overrides = {
            "email": email,
            "uploaded_at": datetime.utcnow().isoformat() + "Z"
        }
        return upsert_documents([str(tmp_path)], collection_name=collection_name, chunk_size=chunk_size, overlap=overlap, metadata_overrides=metadata_overrides)
    finally:
        try:
            tmp_path.unlink()
        except Exception:
            logger.exception("Failed to remove temporary file %s", tmp_path)

