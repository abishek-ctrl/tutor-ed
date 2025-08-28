import redis
import json
from typing import List, Dict
from app.core.config import settings
from groq import Groq
import logging

logger = logging.getLogger("rag.memory")
r = redis.from_url(settings.redis_url, decode_responses=True)
client = Groq(api_key=settings.groq_api_key)

SUMMARY_KEY_FMT = "session:{session_id}:summary"
HISTORY_KEY_FMT = "session:{session_id}:history"  # list

SUMMARIZE_PROMPT = """
You are a concise summarizer. Given a conversation between a tutor and a student, produce a short summary that captures the student's current knowledge state, unanswered questions, and context necessary for future replies. Provide the summary as a short paragraph (1-3 sentences).
CONVERSATION:
{conversation}
"""

def append_turn(session_id: str, role: str, text: str) -> None:
    key = HISTORY_KEY_FMT.format(session_id=session_id)
    entry = {"role": role, "text": text}
    r.rpush(key, json.dumps(entry))
    # Optionally trim to last 50 turns
    r.ltrim(key, -100, -1)

def get_history(session_id: str) -> List[Dict]:
    key = HISTORY_KEY_FMT.format(session_id=session_id)
    items = r.lrange(key, 0, -1)
    return [json.loads(i) for i in items]

def get_summary(session_id: str) -> str:
    key = SUMMARY_KEY_FMT.format(session_id=session_id)
    return r.get(key) or ""

def update_summary_if_needed(session_id: str, threshold_turns: int = 20):
    key = HISTORY_KEY_FMT.format(session_id=session_id)
    length = r.llen(key)
    if length < threshold_turns:
        return
    conv = get_history(session_id)
    text = "\n".join([f"{c['role']}: {c['text']}" for c in conv[-threshold_turns:]])
    prompt = SUMMARIZE_PROMPT.format(conversation=text)
    messages = [
        {"role": "system", "content": "You are a concise summarizer for conversation state."},
        {"role": "user", "content": prompt}
    ]
    try:
        completion = client.chat.completions.create(messages=messages, model=settings.groq_model, temperature=0.0, max_completion_tokens=200)
        summary = completion.choices[0].message.content.strip()
        r.set(SUMMARY_KEY_FMT.format(session_id=session_id), summary)
    except Exception as e:
        logger.exception("Failed to summarize conversation; leaving existing summary unchanged.")
