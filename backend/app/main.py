# backend/app/main.py
import io
import os
import tempfile
import logging
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel
import uvicorn

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from groq import Groq

from app.core.config import settings
from app.rag.retriever import QdrantRetriever
from app.rag.ingest import upsert_file_bytes
from app.rag.generator import generate_answer
from app.rag.emotion import classify_emotion
from app.rag.memory import append_turn, update_summary_if_needed, get_summary

logger = logging.getLogger("ai_tutor")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="RAG Tutor API", version="1.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY") or getattr(settings, "groq_api_key", None))
retriever = QdrantRetriever()

# ---- Utility wrappers for Groq STT / TTS ----
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), retry=retry_if_exception_type(Exception))
def groq_stt_transcribe_from_file(file_path: str, language: Optional[str] = None) -> str:
    try:
        with open(file_path, "rb") as fh:
            transcription = _groq_client.audio.transcriptions.create(
                file=fh,
                model="whisper-large-v3-turbo",
                prompt=None,
                response_format="verbose_json",
                language=language,
                temperature=0.0
            )
        text = ""
        if isinstance(transcription, dict):
            text = transcription.get("text") or transcription.get("transcription") or ""
        else:
            text = getattr(transcription, "text", "") or getattr(transcription, "transcription", "") or str(transcription)
        return text
    except Exception as e:
        logger.exception("Groq STT failed")
        raise

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), retry=retry_if_exception_type(Exception))
def groq_tts_synthesize_to_file(text: str, voice: Optional[str], response_format: str = "wav") -> str:
    if not voice:
        voice = "Fritz-PlayAI"
    try:
        response = _groq_client.audio.speech.create(
            model="playai-tts",
            voice=voice,
            input=text,
            response_format=response_format
        )
        suffix = ".wav" if response_format in ("wav", "wave") else ".mp3"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.close()
        try:
            if hasattr(response, "write_to_file"):
                response.write_to_file(tmp.name)
            else:
                data = getattr(response, "content", None) or (response if isinstance(response, (bytes, bytearray)) else None)
                if data is None and isinstance(response, dict) and response.get("audio"):
                    data = response.get("audio")
                if data is None:
                    raise RuntimeError("Unknown Groq TTS response shape")
                with open(tmp.name, "wb") as fh:
                    fh.write(data)
        except Exception:
            try: os.unlink(tmp.name)
            except Exception: pass
            raise
        return tmp.name
    except Exception as e:
        logger.exception("Groq TTS failed")
        raise

# ---- API endpoints ----
@app.post("/docs/upload")
async def docs_upload(email: Optional[str] = Form(None), files: List[UploadFile] = File(...)):
    try:
        total = 0
        for f in files:
            contents = await f.read()
            res = upsert_file_bytes(contents, f.filename, email=email, collection_name=settings.qdrant_collection)
            total += res.get("upserted_chunks", 0)
        return {"upserted_chunks": total}
    except Exception as e:
        logger.exception("Document upload failed.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docs/list")
async def docs_list(email: Optional[str] = Query(None), limit: int = 200):
    try:
        docs = retriever.list_documents(email=email, limit=limit, batch_size=200)
        return {"docs": docs}
    except Exception as e:
        logger.exception("Docs list failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/docs/delete")
async def docs_delete(email: str = Query(...), file_names: Optional[List[str]] = Query(None)):
    try:
        client = retriever.client
        ids_to_delete = []
        offset = 0
        batch = 200
        while True:
            try:
                raw_points = None
                try:
                    raw_points = client.scroll(collection_name=settings.qdrant_collection, limit=batch, offset=offset)
                except TypeError:
                    raw_points = client.scroll(settings.qdrant_collection, limit=batch, offset=offset)
            except Exception as e:
                logger.exception("Failed to scroll Qdrant during delete: %s", e)
                break
            points = raw_points if isinstance(raw_points, list) else (raw_points.get("result") if isinstance(raw_points, dict) else [])
            if not points:
                break
            for p in points:
                payload = getattr(p, "payload", None) or (p.get("payload") if isinstance(p, dict) else {}) or {}
                p_email = payload.get("email")
                if not p_email or str(p_email).lower() != str(email).lower():
                    continue
                file_name = payload.get("file_name") or payload.get("source") or payload.get("file")
                keep = False
                if file_names:
                    if file_name in file_names:
                        keep = True
                    else:
                        keep = False
                else:
                    keep = True
                if keep:
                    pid = getattr(p, "id", None) or (p.get("id") if isinstance(p, dict) else None)
                    if pid is not None:
                        ids_to_delete.append(pid)
            offset += len(points)
            if len(points) < batch:
                break
        ids_to_delete = list({i for i in ids_to_delete if i is not None})
        if not ids_to_delete:
            return {"deleted": True, "deleted_ids": 0}
        try:
            retriever.client.delete(collection_name=settings.qdrant_collection, points=ids_to_delete)
        except TypeError:
            retriever.client.delete(collection_name=settings.qdrant_collection, ids=ids_to_delete)
        return {"deleted": True, "deleted_ids": len(ids_to_delete)}
    except Exception as e:
        logger.exception("Docs delete failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/has-data")
async def user_has_data(email: str = Query(...)):
    try:
        docs = retriever.list_documents(email=email, limit=1, batch_size=50)
        return {"has_data": len(docs) > 0}
    except Exception as e:
        logger.exception("user/has-data failed")
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    top_k: Optional[int] = 6
    short_answer: Optional[bool] = False

def _build_contexts(message: str, top_k: int, include_summary: bool, session_id: Optional[str]):
    docs = retriever.retrieve(message, top_k=top_k or 6)
    contexts = [{"id": d.id, "text": d.text, "source": d.source} for d in docs]
    if include_summary and session_id:
        summary = get_summary(session_id) or ""
        if summary:
            contexts.insert(0, {"id": "session_summary", "text": summary, "source": "session_summary"})
    return contexts

@app.post("/query")
async def query_endpoint(body: ChatRequest):
    """
    Single-turn query: retrieval + answer without session memory updates.
    Returns: {"text": "...", "emotion": "...", "citations": [...]}
    """
    try:
        contexts = _build_contexts(body.message, body.top_k or 6, include_summary=False, session_id=None)
        gen = generate_answer(body.message, contexts, max_tokens=512, temperature=0.0, short_answer=bool(body.short_answer))
        text = gen["text"].strip()
        emotion = classify_emotion(text)
        citations = [{"id": c["id"], "source": c["source"]} for c in contexts]
        return {"text": text, "emotion": emotion, "citations": citations}
    except Exception as e:
        logger.exception("Query /query failed.")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """
    Multi-turn: retrieval + answer + memory updates.
    """
    try:
        if req.session_id:
            append_turn(req.session_id, "user", f"{req.name or 'user'}: {req.message}")
            update_summary_if_needed(req.session_id, threshold_turns=20)
        contexts = _build_contexts(req.message, req.top_k or 6, include_summary=True, session_id=req.session_id)
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
        suffix = "." + file.filename.split(".")[-1] if "." in file.filename else ".wav"
        allowed = {"flac","mp3","mp4","mpeg","mpga","m4a","ogg","opus","wav","webm"}
        if suffix.lstrip(".").lower() not in allowed:
            suffix = ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp.flush()
            tmp_path = tmp.name
        try:
            transcript = groq_stt_transcribe_from_file(tmp_path)
            return PlainTextResponse(transcript)
        finally:
            try: os.unlink(tmp_path)
            except Exception: pass
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
        tmp_path = groq_tts_synthesize_to_file(text=text, voice=voice, response_format=fmt)
        media_type = "audio/wav" if fmt == "wav" else "audio/mpeg"
        return StreamingResponse(open(tmp_path, "rb"), media_type=media_type)
    except Exception as e:
        logger.exception("TTS endpoint failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        pass

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=getattr(settings, "host", "0.0.0.0"), port=getattr(settings, "port", 8000), reload=False)
