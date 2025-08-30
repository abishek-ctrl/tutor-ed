import logging
from typing import Optional, Generator
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("speech.tts")
client = Groq(api_key=settings.groq_api_key)

DEFAULT_VOICE = "Fritz-PlayAI"
DEFAULT_MODEL = "playai-tts"
DEFAULT_RESPONSE_FORMAT = "wav"

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), retry=retry_if_exception_type(Exception))
def text_to_speech(
    text: str,
    voice: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    response_format: str = DEFAULT_RESPONSE_FORMAT
) -> Generator[bytes, None, None]:
    """
    Convert text -> speech using Groq TTS. Returns a generator for streaming audio bytes.
    """
    if not text:
        raise ValueError("text must be provided")
    voice = voice or DEFAULT_VOICE

    try:
        response = client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            response_format=response_format
        )
        # Stream the response body
        for chunk in response.iter_bytes(chunk_size=4096):
            yield chunk
    except Exception as e:
        logger.exception("Groq TTS failed.")
        raise