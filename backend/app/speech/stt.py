# backend/app/speech/stt.py
import logging
from typing import Tuple
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("speech.stt")
client = Groq(api_key=settings.groq_api_key)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), retry=retry_if_exception_type(Exception))
def transcribe_audio(audio_bytes: bytes, language: str = None) -> str:
    """
    Sends audio to Groq STT endpoint and returns transcript.
    """
    try:
        # API compatible with OpenAI audio transcription endpoint
        result = client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=audio_bytes,
            # optional: provide language ISO code if known to speed up
            language=language,
            response_format="text"
        )
        return result["text"]
    except Exception as e:
        logger.exception("Groq STT transcription failed.")
        raise
