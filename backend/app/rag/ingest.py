from typing import List, Dict, Iterable, Tuple
import os
import re
import math
from pathlib import Path
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, Distance, VectorParams
import tiktoken
import uuid
from app.core.config import settings
from datetime import datetime
import tempfile
import logging

logger = logging.getLogger("rag.ingest")

ENC = tiktoken.get_encoding("cl100k_base")  # token counting
MODEL = SentenceTransformer(settings.embedding_model)


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
        # Try to read as text (for csv, docx -> you may plug docx parser here)
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
    # Simple sentence-aware split
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
                # break large sentence by tokens
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
    vectors = MODEL.encode(list(texts), show_progress_bar=False, convert_to_numpy=True)
    return vectors.tolist()


def _get_qdrant_client(prefer_grpc: bool = False) -> QdrantClient:
    return QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=prefer_grpc)


def upsert_documents(paths: List[str],
                     collection_name: str = settings.qdrant_collection,
                     chunk_size: int = settings.chunk_token_size,
                     overlap: int = settings.chunk_overlap,
                     metadata_overrides: Dict = None) -> Dict[str, int]:
    """
    Existing helper: ingest files from disk paths. Keeps behavior backward compatible.
    """
    client = _get_qdrant_client(prefer_grpc=False)
    example_vec = MODEL.encode("example", convert_to_numpy=True)
    dim = int(example_vec.shape[0])

    # Create collection if not exists (idempotent recreation uses recreate_collection)
    try:
        client.get_collection(collection_name)
    except Exception:
        client.recreate_collection(
            collection_name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
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
                "source": p.name,
                "source_path": str(p.resolve()),
                "file_name": p.name,
                "chunk_index": idx,
                "text": chunk,
            }
            if metadata_overrides:
                payload.update(metadata_overrides)
            points.append(PointStruct(id=chunk_id, vector=vec, payload=payload))
            uploaded += 1

        client.upsert(collection_name=collection_name, points=points)
    return {"upserted_chunks": uploaded}


def upsert_file_bytes(file_bytes: bytes,
                      filename: str,
                      email: str = None,
                      collection_name: str = settings.qdrant_collection,
                      chunk_size: int = settings.chunk_token_size,
                      overlap: int = settings.chunk_overlap) -> Dict[str, int]:
    """
    Accept raw bytes (uploaded file), write to temp file, and ingest.
    Stores metadata: email, file_name, uploaded_at.
    Returns: {'upserted_chunks': N}
    """
    suffix = Path(filename).suffix or ".txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        tmp_path = Path(tmp.name)

    try:
        metadata_overrides = {
            "email": email,
            "file_name": filename,
            "uploaded_at": datetime.utcnow().isoformat() + "Z"
        }
        return upsert_documents([str(tmp_path)], collection_name=collection_name, chunk_size=chunk_size, overlap=overlap, metadata_overrides=metadata_overrides)
    finally:
        try:
            tmp_path.unlink()
        except Exception:
            logger.exception("Failed to remove temporary file %s", tmp_path)


def upsert_multiple_files(files: List[Dict], email: str = None, collection_name: str = settings.qdrant_collection):
    """
    files: list of {'bytes': b'...', 'filename': 'name.pdf'}
    """
    total = 0
    for f in files:
        res = upsert_file_bytes(f['bytes'], f['filename'], email=email, collection_name=collection_name)
        total += res.get("upserted_chunks", 0)
    return {"upserted_chunks": total}
