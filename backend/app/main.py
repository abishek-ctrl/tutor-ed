import io
import os
import tempfile
import logging
from typing import Optional, List, Dict, Any
import re
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel
import uvicorn
from qdrant_client import models

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from groq import Groq

from app.core.config import settings
from app.rag.retriever import QdrantRetriever
from app.rag.ingest import upsert_file_bytes
from app.rag.generator import generate_answer
from app.rag.emotion import classify_emotion
from app.rag.memory import append_turn, update_summary_if_needed, get_summary
from app.speech.tts import text_to_speech
from app.speech.stt import transcribe_audio

logger = logging.getLogger("ai_tutor")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="RAG Tutor API", version="1.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY") or getattr(settings, "groq_api_key", None))

def sanitize_email_for_collection(email: str) -> str:
    """Sanitizes an email address to be used as a Qdrant collection name."""
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '_', email)
    return f"{settings.qdrant_collection_prefix}_{sanitized}"

# ---- API endpoints ----
@app.post("/docs/upload")
async def docs_upload(email: str = Form(...), files: List[UploadFile] = File(...)):
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    
    collection_name = sanitize_email_for_collection(email)
    
    try:
        total = 0
        for f in files:
            contents = await f.read()
            res = upsert_file_bytes(contents, f.filename, email=email, collection_name=collection_name)
            total += res.get("upserted_chunks", 0)
        return {"upserted_chunks": total}
    except Exception as e:
        logger.exception("Document upload failed.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs/list")
async def docs_list(email: str = Query(...), limit: int = 200):
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
        
    collection_name = sanitize_email_for_collection(email)
    retriever = QdrantRetriever(collection=collection_name)

    try:
        docs = retriever.list_documents(limit=limit, batch_size=200)
        return {"docs": docs}
    except Exception as e:
        # If the collection doesn't exist, it's not an error, just means no documents.
        if "not found" in str(e).lower():
            return {"docs": []}
        logger.exception("Docs list failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/docs/delete")
async def docs_delete(email: str = Query(...)):
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
        
    collection_name = sanitize_email_for_collection(email)
    retriever = QdrantRetriever(collection=collection_name)
    
    try:
        # Deleting the entire collection for the user
        retriever.client.delete_collection(collection_name=collection_name)
        return {"deleted": True, "collection_name": collection_name}
    except Exception as e:
        logger.exception("Docs delete failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/has-data")
async def user_has_data(email: str = Query(...)):
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    
    collection_name = sanitize_email_for_collection(email)
    retriever = QdrantRetriever(collection=collection_name)
    
    try:
        # Check if the collection exists and has at least one document.
        collection_info = retriever.client.get_collection(collection_name=collection_name)
        has_data = collection_info.points_count > 0
        return {"has_data": has_data}
    except Exception as e:
        # If the collection doesn't exist, then the user has no data.
        return {"has_data": False}

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: str
    top_k: Optional[int] = 6
    short_answer: Optional[bool] = False

def _build_contexts(message: str, top_k: int, include_summary: bool, session_id: Optional[str], collection_name: str):
    retriever = QdrantRetriever(collection=collection_name)
    docs = retriever.retrieve(message, top_k=top_k or 6)
    contexts = [{"id": d.id, "text": d.text, "source": d.source} for d in docs]
    if include_summary and session_id:
        summary = get_summary(session_id) or ""
        if summary:
            contexts.insert(0, {"id": "session_summary", "text": summary, "source": "session_summary"})
    return contexts

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """
    Multi-turn: retrieval + answer + memory updates.
    """
    if not req.email:
        raise HTTPException(status_code=400, detail="Email is required for chat.")

    collection_name = sanitize_email_for_collection(req.email)
    
    try:
        if req.session_id:
            append_turn(req.session_id, "user", f"{req.name or 'user'}: {req.message}")
            update_summary_if_needed(req.session_id, threshold_turns=20)
        
        contexts = _build_contexts(req.message, req.top_k or 6, include_summary=True, session_id=req.session_id, collection_name=collection_name)
        gen = generate_answer(req.message, contexts, max_tokens=512, temperature=0.0, short_answer=bool(req.short_answer))
        text = gen["text"].strip()
        emotion = classify_emotion(text)
        
        if req.session_id:
            append_turn(req.session_id, "assistant", text)
            
        citations = [{"id": c["id"], "source": c["source"]} for c in contexts if c.get("id") != "session_summary"]
        return {"session_id": req.session_id, "text": text, "emotion": emotion, "citations": citations}
    except Exception as e:
        logger.exception("Chat /chat failed.")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stt")
async def stt_endpoint(file: UploadFile = File(...), email: Optional[str] = Form(None)):
    try:
        contents = await file.read()
        transcript = transcribe_audio(contents)
        return PlainTextResponse(transcript)
    except Exception as e:
        logger.exception("STT endpoint failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tts")
async def tts_endpoint(body: Dict[str, Any] = Body(...)):
    text = body.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' in request body.")
    voice = body.get("voice") or "Fritz-PlayAI"
    fmt = (body.get("format") or "wav").lower()
    if fmt not in ("wav", "mp3"):
        fmt = "wav"
    try:
        audio_stream = text_to_speech(text=text, voice=voice, response_format=fmt)
        media_type = "audio/wav" if fmt == "wav" else "audio/mpeg"
        return StreamingResponse(audio_stream, media_type=media_type)
    except Exception as e:
        logger.exception("TTS endpoint failed")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=getattr(settings, "host", "0.0.0.0"), port=getattr(settings, "port", 8000), reload=True)