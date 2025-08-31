from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient, models
from dataclasses import dataclass
from app.core.config import settings
import logging
import numpy as np
import google.generativeai as genai

logger = logging.getLogger("rag.retriever")

# Configure the Gemini client
try:
    genai.configure(api_key=settings.google_api_key)
except Exception as e:
    logger.error("Failed to configure Gemini client: %s", e)

@dataclass
class RetrievedDoc:
    id: str
    score: float
    text: str
    source: str
    metadata: Dict[str, Any]


class QdrantRetriever:
    def __init__(self, collection: str):
        self.client = QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=True)
        self.collection = collection

    def embed_query(self, query: str) -> List[float]:
        """Generates and normalizes an embedding for a single query using the Gemini API."""
        try:
            result = genai.embed_content(
                model=settings.gemini_embedding_model,
                content=query,
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=settings.gemini_embedding_dimensionality
            )
            raw_embedding = result['embedding']
            
            emb_np = np.array(raw_embedding)
            norm = np.linalg.norm(emb_np)
            if norm > 0:
                return (emb_np / norm).tolist()
            else:
                return [0.0] * settings.gemini_embedding_dimensionality

        except Exception as e:
            logger.error(f"Gemini query embedding failed: {e}")
            return [0.0] * settings.gemini_embedding_dimensionality

    def retrieve(self, query: str, top_k: int = 8, filter_payload: Optional[models.Filter] = None) -> List[RetrievedDoc]:
        qvec = self.embed_query(query)
        results = self.client.search(
            collection_name=self.collection,
            query_vector=qvec,
            limit=top_k,
            query_filter=filter_payload
        )
        docs: List[RetrievedDoc] = []
        for r in results:
            payload = r.payload or {}
            docs.append(RetrievedDoc(
                id=str(r.id),
                score=float(getattr(r, "score", 0.0)),
                text=payload.get("text", ""),
                source=payload.get("file_name") or payload.get("source") or "",
                metadata=payload
            ))
        return docs

    def list_documents(self, limit: int = 1000, batch_size: int = 50) -> List[Dict[str, Any]]:
        unique: Dict[str, Dict[str, Any]] = {}
        offset = None

        while True:
            try:
                raw_points, next_offset = self.client.scroll(
                    collection_name=self.collection,
                    limit=batch_size,
                    offset=offset,
                    with_payload=True,
                )
            except Exception as e:
                logger.exception("Failed to scroll Qdrant collection: %s", e)
                break

            if not raw_points:
                break

            for p in raw_points:
                payload = p.payload or {}
                source = payload.get("file_name") or payload.get("source") or "unknown"
                snippet = (payload.get("text") or "")[:200]

                if source not in unique:
                    unique[source] = {"source": source, "snippet": snippet}
                if len(unique) >= limit:
                    break
            
            offset = next_offset
            if not offset or len(unique) >= limit:
                break
        
        return list(unique.values())

