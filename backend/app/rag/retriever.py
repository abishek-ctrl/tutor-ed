from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
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
        Handles:
         - list of ScoredPoint / Point structs
         - dict wrappers like {"result": [...]} or {"points": [...]}
         - nested lists (e.g. [[...], [...]])
         - dicts that contain 'result' or 'points'
        """
        if points_raw is None:
            return []
        # dict wrappers
        if isinstance(points_raw, dict):
            if "result" in points_raw and isinstance(points_raw["result"], list):
                return points_raw["result"]
            if "points" in points_raw and isinstance(points_raw["points"], list):
                return points_raw["points"]
        # if list
        if isinstance(points_raw, list):
            # Flatten one level if nested lists
            if points_raw and all(isinstance(x, list) for x in points_raw):
                flat = []
                for sub in points_raw:
                    flat.extend(sub)
                return flat
            return points_raw
        # fallback: single object -> wrap
        return [points_raw]

    def list_documents(self, email: Optional[str] = None, limit: int = 1000, batch_size: int = 200) -> List[Dict[str, Any]]:
        """
        Page through Qdrant collection and return a list of unique document sources with a short snippet.
        If email is provided, only return documents where payload.email == email.
        Returns list of {"source": str, "snippet": str, "email": str|None}
        """
        unique: Dict[str, Dict[str, Any]] = {}
        offset = 0

        # Defensive: ensure scroll exists
        scroll_fn = getattr(self.client, "scroll", None)
        if scroll_fn is None:
            raise RuntimeError("Qdrant client does not support scroll(); please upgrade qdrant-client.")

        while True:
            try:
                try:
                    raw_points = self.client.scroll(collection_name=self.collection, limit=batch_size, offset=offset)
                except TypeError:
                    # fallback to positional signature
                    raw_points = self.client.scroll(self.collection, limit=batch_size, offset=offset)
            except Exception as e:
                logger.exception("Failed to scroll Qdrant collection: %s", e)
                break

            points = self._normalize_scroll_points(raw_points)
            if not points:
                break

            for p in points:
                payload = {}
                try:
                    if hasattr(p, "payload"):
                        payload = p.payload or {}
                    elif isinstance(p, dict):
                        payload = p.get("payload") or {}
                    else:
                        payload = getattr(p, "payload", {}) or {}
                except Exception:
                    payload = {}

                # filter by email if provided
                if email:
                    p_email = payload.get("email")
                    if not p_email or str(p_email).lower() != str(email).lower():
                        continue

                source = payload.get("file_name") or payload.get("source") or payload.get("source_path") or "unknown"
                if not isinstance(source, str):
                    source = str(source)
                snippet = (payload.get("text") or "")[:500]

                if source not in unique:
                    unique[source] = {"source": source, "snippet": snippet, "email": payload.get("email")}
                if len(unique) >= limit:
                    break

            offset += len(points)
            if len(points) < batch_size or len(unique) >= limit:
                break

        docs = list(unique.values())[:limit]
        return docs
