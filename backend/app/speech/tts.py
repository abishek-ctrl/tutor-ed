import logging
import tempfile
import os
from typing import Optional
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger("speech.tts")
client = Groq(api_key=settings.groq_api_key)

# Default voice (English). You can change to any voice listed in the docs.
DEFAULT_VOICE = "Fritz-PlayAI"
DEFAULT_MODEL = "playai-tts"
DEFAULT_RESPONSE_FORMAT = "wav"

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), retry=retry_if_exception_type(Exception))
def text_to_speech(
    text: str,
    voice: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    response_format: str = DEFAULT_RESPONSE_FORMAT
) -> bytes:
    """
    Convert text -> speech using Groq TTS. Returns raw audio bytes (WAV by default).
    This uses the Groq Python SDK and the SDK helper `write_to_file` to get a binary
    response in a filesystem-safe way, then returns bytes.
    """
    if not text:
        raise ValueError("text must be provided")
    voice = voice or DEFAULT_VOICE

    try:
        # The Groq TTS API expects the field name "input" for the text per docs.
        # The SDK's BinaryAPIResponse exposes write_to_file, which we call to persist to a temp file.
        response = client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            response_format=response_format
        )
        # response is a BinaryAPIResponse-like object; the docs show example usage:
        # response.write_to_file(speech_file_path)
        # We'll write to a temp file and read bytes back to return.
        with tempfile.NamedTemporaryFile(suffix=f".{response_format}", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            # write binary response to file using SDK helper
            # (docs example uses response.write_to_file())
            if hasattr(response, "write_to_file"):
                response.write_to_file(tmp_path)
            else:
                # Fallback: try to treat response as raw bytes-like object
                # Some SDK versions may return bytes directly
                if isinstance(response, (bytes, bytearray)):
                    with open(tmp_path, "wb") as fh:
                        fh.write(response)
                else:
                    # last resort: try to get .content or .read()
                    content = getattr(response, "content", None) or getattr(response, "read", None)
                    if callable(content):
                        body = content()
                    else:
                        body = content
                    if not body:
                        raise RuntimeError("Unable to extract audio content from Groq response object.")
                    with open(tmp_path, "wb") as fh:
                        fh.write(body)

            # Read bytes back and return
            with open(tmp_path, "rb") as fh:
                audio_bytes = fh.read()
            return audio_bytes
        finally:
            # Quietly remove the temp file if present
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    except Exception as e:
        logger.exception("Groq TTS failed.")
        # Re-raise so caller gets a clear exception and stacktrace
        raise
