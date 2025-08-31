from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass
from app.core.config import settings
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
    def __init__(self, collection: str):
        self.client = QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=True)
        self.collection = collection

    def embed_query(self, query: str) -> List[float]:
        vec = EMBED_MODEL.encode(query, convert_to_numpy=True)
        return vec.tolist()

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