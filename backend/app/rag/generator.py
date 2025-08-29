from typing import List, Dict, Any
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
from app.core.config import settings

logger = logging.getLogger("rag.generator")
client = Groq(api_key=settings.groq_api_key)

BASE_SYSTEM_PROMPT = """
You are an expert tutor for undergraduate STEM topics. Use only the information provided in the 'CONTEXT' sections when making factual claims. Always include a short CITATIONS: line at the end like [1], [2].
"""

CONCISE_INSTRUCTION = "Answer concisely in 1–3 short sentences. Be direct and to the point."

def build_messages(question: str, contexts: List[Dict[str, Any]], short_answer: bool = False) -> List[Dict[str, str]]:
    context_texts = []
    for i, ctx in enumerate(contexts, start=1):
        context_texts.append(f"[{i}] Source: {ctx.get('source','unknown')}\n{ctx.get('text','')}")
    big_context = "\n\n".join(context_texts) if context_texts else ""
    user_content = f"CONTEXT:\n{big_context}\n\nQUESTION:\n{question}\n\nAnswer using only the CONTEXT. If not in context, say 'I don't know based on the provided materials.' Provide short inline CITATIONS like [1]."
    if short_answer:
        user_content = CONCISE_INSTRUCTION + " " + user_content

    messages = [
        {"role": "system", "content": BASE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    return messages


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), retry=retry_if_exception_type(Exception))
def generate_answer(question: str, contexts: List[Dict[str, Any]], max_tokens: int = 512, temperature: float = 0.0, short_answer: bool = False) -> Dict[str, Any]:
    messages = build_messages(question, contexts, short_answer=short_answer)
    try:
        completion = client.chat.completions.create(
            messages=messages,
            model=settings.groq_model,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            stream=False,
        )
        content = completion.choices[0].message.content
        return {"text": content, "raw": completion}
    except Exception as e:
        logger.exception("Groq generation failed.")
        raise
