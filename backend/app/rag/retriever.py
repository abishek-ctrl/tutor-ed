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
                score=float(getattr(r, "score", 0.0)),
                text=payload.get("text", ""),
                source=payload.get("file_name") or payload.get("source") or "",
                metadata=payload
            ))
        return docs

    def _normalize_scroll_points(self, points_raw) -> List[Any]:
        """
        Normalize different qdrant-client scroll return shapes into a flat list of point-like objects.
        """
        if points_raw is None:
            return []
        # The scroll API response is a tuple: (list_of_points, next_page_offset)
        if isinstance(points_raw, tuple) and len(points_raw) > 0 and isinstance(points_raw[0], list):
            return points_raw[0]
        if isinstance(points_raw, list):
            return points_raw
        return [points_raw]


    def list_documents(self, email: Optional[str] = None, limit: int = 1000, batch_size: int = 50) -> List[Dict[str, Any]]:
        """
        Page through Qdrant collection and return a list of unique document sources with a short snippet.
        If email is provided, only return documents where payload.email == email.
        """
        unique: Dict[str, Dict[str, Any]] = {}
        offset = None # Start with None for the first request

        # Define the filter
        scroll_filter = None
        if email:
            logger.info(f"Filtering documents for email: {email}")
            scroll_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="email",
                        match=models.MatchValue(value=email),
                    )
                ]
            )

        while True:
            try:
                # The scroll method returns a tuple: (points, next_page_offset)
                raw_points, next_offset = self.client.scroll(
                    collection_name=self.collection,
                    limit=batch_size,
                    offset=offset,
                    with_payload=True,
                    scroll_filter=scroll_filter
                )
            except Exception as e:
                logger.exception("Failed to scroll Qdrant collection: %s", e)
                break

            points = self._normalize_scroll_points(raw_points)
            if not points:
                break

            for p in points:
                payload = p.payload or {}
                p_email = payload.get("email")
                # This log helps confirm the email in the document payload
                logger.debug(f"Found document with email in payload: {p_email}")

                source = payload.get("file_name") or payload.get("source") or "unknown"
                snippet = (payload.get("text") or "")[:200]

                if source not in unique:
                    unique[source] = {"source": source, "snippet": snippet, "email": p_email}
                if len(unique) >= limit:
                    break
            
            offset = next_offset # Use the offset for the next page
            if not offset or len(unique) >= limit:
                break
        
        docs = list(unique.values())
        logger.info(f"Found {len(docs)} unique documents for email {email}.")
        return docs