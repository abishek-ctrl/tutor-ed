# backend/app/speech/tts.py
import logging
from typing import Optional
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("speech.tts")
client = Groq(api_key=settings.groq_api_key)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), retry=retry_if_exception_type(Exception))
def text_to_speech(text: str, voice: Optional[str] = None, response_format: str = "wav") -> bytes:
    """
    Converts text into speech audio using Groq TTS.
    Returns audio bytes.
    """
    try:
        response = client.audio.speech.create(
            model="playai-tts",
            input=text,
            voice=voice,
            response_format=response_format
        )
        # response returns binary audio content
        return response
    except Exception as e:
        logger.exception("Groq TTS failed.")
        raise
