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
        # fallback: treat binary as text
        return path.read_text(encoding="utf-8", errors="ignore")


def _token_len(text: str) -> int:
    return len(ENC.encode(text))


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 64) -> List[str]:
    """
    Chunk text into token-aware chunks with overlap.
    Uses simple sentence boundary segmentation for stability.
    """
    # Basic normalization
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # Split roughly on sentences to be token-aware
    # This is a pragmatic sentence split (not language-perfect)
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
            # flush current
            if current:
                chunks.append(" ".join(current).strip())
            # if single sentence > chunk_size, break it deterministically
            if sent_tokens > chunk_size:
                # break by characters into subpieces keeping token size
                start = 0
                sent_enc = ENC.encode(sent)
                while start < len(sent_enc):
                    piece_enc = sent_enc[start:start + chunk_size]
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
    # SentenceTransformer returns dense vectors (float32)
    vectors = MODEL.encode(list(texts), show_progress_bar=False, convert_to_numpy=True)
    return vectors.tolist()


def upsert_documents(
    paths: List[str],
    collection_name: str = settings.qdrant_collection,
    chunk_size: int = settings.chunk_token_size,
    overlap: int = settings.chunk_overlap,
) -> Dict[str, int]:
    client = QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=False)

    # Ensure collection exists with vector size
    example_vec = MODEL.encode("example", convert_to_numpy=True)
    dim = int(example_vec.shape[0])

    # Create collection if not exists
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
                "chunk_index": idx,
                "text": chunk,
            }
            # Qdrant PointStruct
            points.append(PointStruct(id=chunk_id, vector=vec, payload=payload))
            uploaded += 1

        # Upsert batch (Qdrant helper ensures batching)
        client.upsert(collection_name=collection_name, points=points)

    return {"upserted_chunks": uploaded}
