import uvicorn
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.rag.retriever import QdrantRetriever, RetrievedDoc
from app.rag.generator import generate_answer
from app.rag.emotion import classify_emotion
from app.rag.memory import append_turn, update_summary_if_needed, get_summary
from app.core.config import settings
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi import File, UploadFile
from app.speech.stt import transcribe_audio
from fastapi.responses import StreamingResponse, PlainTextResponse, Response
from app.speech.tts import text_to_speech
from app.rag.ingest import upsert_file_bytes
from qdrant_client import QdrantClient
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core.config import settings
from app.rag.retriever import QdrantRetriever
from app.rag.ingest import upsert_file_bytes


logger = logging.getLogger("ai_tutor")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="RAG Tutor API", version="1.0")

# CORS - for local dev allow all; in prod set origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

retriever = QdrantRetriever()


class QueryRequest(BaseModel):
    query: str = Field(..., description="Single-turn query text")
    namespace: Optional[str] = Field(None, description="Optional namespace / collection")
    top_k: Optional[int] = Field(6, description="Number of retrieved chunks to include")


class QueryResponse(BaseModel):
    text: str
    emotion: str
    citations: List[Dict[str, Any]] = []
    raw: Optional[Dict[str, Any]] = None


@app.post("/query", response_model=QueryResponse)
async def query_single(req: QueryRequest):
    try:
        top_k = req.top_k or 6
        docs = retriever.retrieve(req.query, top_k=top_k)
        contexts = [{"id": d.id, "text": d.text, "source": d.source} for d in docs]

        # Generate answer
        gen = generate_answer(req.query, contexts, max_tokens=512, temperature=0.0)
        text = gen["text"]

        # Classify emotion
        emotion = classify_emotion(text)

        # Build citation list from contexts used (we include top_k mapping)
        citations = [{"id": c["id"], "source": c["source"]} for c in contexts]

        return QueryResponse(text=text, emotion=emotion, citations=citations, raw=None)
    except Exception as e:
        logger.exception("Query /query failed.")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stt")
async def stt_endpoint(file: UploadFile = File(...), language: Optional[str] = None):
    try:
        audio = await file.read()
        transcript = transcribe_audio(audio, language=language)
        return PlainTextResponse(transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tts")
async def tts_endpoint(payload: Dict[str, Any] = Body(...)):
    """
    Expects JSON:
      { "text": "...", "voice": "Fritz-PlayAI", "format": "wav" }
    voice is optional; defaults to Fritz-PlayAI if omitted.
    """
    text = payload.get("text")
    voice = payload.get("voice")
    fmt = payload.get("format", "wav")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' field.")
    try:
        audio_bytes = text_to_speech(text=text, voice=voice, response_format=fmt)
        # Return raw bytes with appropriate media type
        media_type = "audio/wav" if fmt.lower() == "wav" else "application/octet-stream"
        return Response(content=audio_bytes, media_type=media_type)
    except Exception as e:
        logger.exception("Error in /tts endpoint")
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    session_id: str
    top_k: Optional[int] = Field(6)


class ChatResponse(BaseModel):
    session_id: str
    text: str
    emotion: str
    citations: List[Dict[str, Any]]


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        # Persist user turn
        append_turn(req.session_id, "user", req.message)
        # Optionally update summary if conversation long
        update_summary_if_needed(req.session_id, threshold_turns=20)
        summary = get_summary(req.session_id) or ""

        # Retrieve docs
        docs = retriever.retrieve(req.message, top_k=req.top_k or 6)
        contexts = [{"id": d.id, "text": d.text, "source": d.source} for d in docs]

        # Inject summary as an additional context (if exists)
        if summary:
            contexts.insert(0, {"id": "session_summary", "text": summary, "source": "session_summary"})

        gen = generate_answer(req.message, contexts, max_tokens=512, temperature=0.0)
        text = gen["text"]
        emotion = classify_emotion(text)

        # Save assistant turn
        append_turn(req.session_id, "assistant", text)

        citations = [{"id": c["id"], "source": c["source"]} for c in contexts if c.get("id") != "session_summary"]

        return ChatResponse(session_id=req.session_id, text=text, emotion=emotion, citations=citations)
    except Exception as e:
        logger.exception("Chat /chat failed.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs/list")
async def docs_list(limit: int = 200):
    """
    Return a list of indexed documents (source + snippet).
    Response: { "docs": [ { "source": "...", "snippet": "..." }, ... ] }
    """
    try:
        # Use the retriever helper to page Qdrant and deduplicate sources
        docs = retriever.list_documents(limit=limit, batch_size=200)
        # return a plain dict (FastAPI will serialize to JSON)
        return {"docs": docs}
    except Exception as e:
        logger.exception("Docs list failed")
        # return a standard error response
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/docs/upload")
async def docs_upload(file: UploadFile = File(...)):
    """
    Accept a single file, ingest into Qdrant, and return upserted chunks count.
    Example response: {"upserted_chunks": 42}
    """
    try:
        contents = await file.read()
        # upsert_file_bytes writes a temp file, chunks, embeds, and upserts to Qdrant
        res = upsert_file_bytes(contents, file.filename, collection_name=settings.qdrant_collection)
        # Return the result dict produced by upsert_file_bytes (e.g., {"upserted_chunks": N})
        return res
    except Exception as e:
        logger.exception("Document upload failed.")
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
