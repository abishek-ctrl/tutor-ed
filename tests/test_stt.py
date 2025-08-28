import os
import requests
import sys

API_BASE = os.getenv("RAG_API_BASE", "http://127.0.0.1:8000")
STT_ENDPOINT = f"{API_BASE}/stt"
SAMPLE_PATH = os.getenv("STT_SAMPLE", "samples/test_speech.wav")
TIMEOUT = 60  # seconds


def test_stt_basic(sample_path: str = SAMPLE_PATH):
    if not os.path.exists(sample_path):
        raise FileNotFoundError(f"STT sample not found at {sample_path}. Record one or set STT_SAMPLE env var.")

    with open(sample_path, "rb") as fh:
        files = {"file": (os.path.basename(sample_path), fh, "audio/wav")}
        print(f"[test_stt] uploading {sample_path} to {STT_ENDPOINT}")
        resp = requests.post(STT_ENDPOINT, files=files, timeout=TIMEOUT)

    if resp.status_code != 200:
        raise AssertionError(f"STT endpoint returned non-200: {resp.status_code} -> {resp.text}")

    transcript = resp.text.strip()
    if not transcript:
        raise AssertionError("STT returned an empty transcript")

    print("[test_stt] Transcription result:")
    print(transcript)
    if not any(c.isalpha() for c in transcript):
        raise AssertionError("Transcript contains no alphabetic characters; likely failed")

    print("[test_stt] STT successful.")


if __name__ == "__main__":
    sample = sys.argv[1] if len(sys.argv) > 1 else SAMPLE_PATH
    test_stt_basic(sample)
