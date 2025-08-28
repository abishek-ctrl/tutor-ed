# backend/app/rag/retriever.py
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest_models
from app.core.config import settings
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass
import logging

logger = logging.getLogger("rag.retriever")
EMBED_MODEL = SentenceTransformer(settings.embedding_model)


@dataclass
class RetrievedDoc:
    id: str
    score: float
    text: str
    source: str
    metadata: Dict[str, Any]


class QdrantRetriever:
    def __init__(self, collection: str = settings.qdrant_collection):
        # Use HTTPS client (prefer_grpc=False) for Qdrant Cloud compatibility.
        self.client = QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=False)
        self.collection = collection

    def embed_query(self, query: str) -> List[float]:
        vec = EMBED_MODEL.encode(query, convert_to_numpy=True)
        return vec.tolist()

    def retrieve(self, query: str, top_k: int = 8, filter_payload: dict = None) -> List[RetrievedDoc]:
        qvec = self.embed_query(query)
        # Qdrant returns list of ScoredPoint or PointStruct depending on client version.
        results = self.client.search(collection_name=self.collection, query_vector=qvec, limit=top_k)
        docs: List[RetrievedDoc] = []
        for r in results:
            payload = r.payload or {}
            docs.append(RetrievedDoc(
                id=str(r.id),
                score=float(r.score),
                text=payload.get("text", ""),
                source=payload.get("source", ""),
                metadata=payload
            ))
        return docs

    def list_documents(self, limit: int = 1000, batch_size: int = 200) -> List[Dict[str, Any]]:
        """
        Page through Qdrant collection and return a list of unique document sources with a short snippet.
        Returns list of {"source": str, "snippet": str}
        """
        unique: Dict[str, Dict[str, Any]] = {}
        offset = 0

        # Defensive: some qdrant-client versions use different signatures for scroll()
        scroll_fn = getattr(self.client, "scroll", None)
        if scroll_fn is None:
            raise RuntimeError("Qdrant client does not support scroll(). Please upgrade qdrant-client.")

        while True:
            try:
                # Note: some qdrant-client versions accept collection_name as keyword, others positional.
                try:
                    points = self.client.scroll(collection_name=self.collection, limit=batch_size, offset=offset)
                except TypeError:
                    # fallback to positional if signature differs
                    points = self.client.scroll(self.collection, limit=batch_size, offset=offset)
            except Exception as e:
                logger.exception("Failed to scroll Qdrant collection: %s", e)
                break

            # points may be an empty list when exhausted
            if not points:
                break

            for p in points:
                payload = getattr(p, "payload", None) or {}
                source = payload.get("source") or payload.get("source_path") or payload.get("file_name") or "unknown"
                if not isinstance(source, str):
                    source = str(source)
                snippet = (payload.get("text") or "")[:500]
                if source not in unique:
                    unique[source] = {"source": source, "snippet": snippet}

                # Stop early if we already reached the desired number of unique docs
                if len(unique) >= limit:
                    break

            offset += len(points)
            # If we received fewer than batch_size results, we're at the end
            if len(points) < batch_size or len(unique) >= limit:
                break

        docs = list(unique.values())[:limit]
        return docs
