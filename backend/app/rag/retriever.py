from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http.models import ScoredPoint
from app.core.config import settings
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass
import numpy as np

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
        self.client = QdrantClient(url=str(settings.qdrant_url), api_key=settings.qdrant_api_key, prefer_grpc=False)
        self.collection = collection

    def embed_query(self, query: str) -> List[float]:
        vec = EMBED_MODEL.encode(query, convert_to_numpy=True)
        return vec.tolist()

    def retrieve(self, query: str, top_k: int = 8, filter_payload: dict = None) -> List[RetrievedDoc]:
        qvec = self.embed_query(query)
        results: List[ScoredPoint] = self.client.search(collection_name=self.collection, query_vector=qvec, limit=top_k)

        docs = []
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
