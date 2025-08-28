from groq import Groq
from app.core.config import settings
import logging

logger = logging.getLogger("rag.emotion")
client = Groq(api_key=settings.groq_api_key)

EMOTIONS = ["happy", "thinking", "explaining", "clarifying", "neutral", "encouraging"]

PROMPT = """
You are a concise classifier. Given the assistant's answer below, return exactly one word (only the word) that best describes the emotional state or intent of the assistant. Choose one of: happy, thinking, explaining, clarifying, neutral, encouraging.

Answer:
-----
{answer}
-----
Respond with exactly one word from the list. No punctuation.
"""

def classify_emotion(answer_text: str) -> str:
    prompt = PROMPT.format(answer=answer_text)
    messages = [
        {"role": "system", "content": "You are an accurate classifier that outputs exactly one label."},
        {"role": "user", "content": prompt},
    ]
    try:
        completion = client.chat.completions.create(messages=messages, model=settings.groq_model, temperature=0.0, max_completion_tokens=8)
        label = completion.choices[0].message.content.strip().lower()
        if label not in EMOTIONS:
            logger.warning("Received unexpected emotion label: %s", label)
            return "neutral"
        return label
    except Exception as e:
        logger.exception("Emotion classification failed, defaulting to neutral.")
        return "neutral"
