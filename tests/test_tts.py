import os
import requests
import time
import wave
import contextlib

API_BASE = os.getenv("RAG_API_BASE", "http://127.0.0.1:8000")
TTS_ENDPOINT = f"{API_BASE}/tts"
OUT_PATH = os.getenv("TTS_OUT", "/tmp/groq_tts_output.wav")
TIMEOUT = 30  # seconds


def assert_is_wav_file(path: str) -> None:
    # Quick WAV header validation using wave module
    with contextlib.closing(wave.open(path, 'rb')) as wf:
        nchannels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        nframes = wf.getnframes()
        if nchannels <= 0 or sampwidth not in (1, 2, 3, 4) or framerate <= 0 or nframes <= 0:
            raise AssertionError("Invalid WAV file parameters")
    # If no exception, header looks valid


def test_tts_basic():
    payload = {
        "model": "playai-tts",
        "text": "Hello! This is a test of the Groq T T S service. Please transcribe this sentence to verify TTS output.",
        "format": "wav",
        "voice": "Fritz-PlayAI",

    }

    headers = {"Content-Type": "application/json"}
    print(f"[test_tts] sending POST to {TTS_ENDPOINT} with timeout={TIMEOUT}s")
    resp = requests.post(TTS_ENDPOINT, json=payload, headers=headers, timeout=TIMEOUT, stream=True)

    if resp.status_code != 200:
        raise AssertionError(f"TTS endpoint returned non-200: {resp.status_code} -> {resp.text}")

    # Save stream to file
    total_bytes = 0
    with open(OUT_PATH, "wb") as fh:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                fh.write(chunk)
                total_bytes += len(chunk)

    if total_bytes == 0:
        raise AssertionError("No audio bytes returned from TTS endpoint")

    print(f"[test_tts] saved {total_bytes} bytes to {OUT_PATH}")

    # Validate WAV header
    try:
        assert_is_wav_file(OUT_PATH)
    except Exception as e:
        raise AssertionError(f"WAV validation failed: {e}")

    print("[test_tts] TTS successful and WAV validated.")


if __name__ == "__main__":
    test_tts_basic()
