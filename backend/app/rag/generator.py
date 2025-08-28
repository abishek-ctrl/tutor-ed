from typing import List, Dict, Any
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
import json
from app.core.config import settings

logger = logging.getLogger("rag.generator")
client = Groq(api_key=settings.groq_api_key)


SYSTEM_PROMPT = """
You are an expert tutor for undergraduate STEM topics. Provide concise, direct answers—preferably 1–3 short sentences. Use only the information provided in the 'CONTEXT' sections for factual claims. If the answer is not present in the provided context, respond: "I don't know based on the provided materials." Always include a short CITATIONS: line at the end with numbered references like [1], [2]. Do not produce long essays.
"""

# Compose the prompt by concatenating the top contexts with labels [1], [2], ...
def build_messages(question: str, contexts: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    context_texts = []
    for i, ctx in enumerate(contexts, start=1):
        # include id and source metadata
        context_texts.append(f"[{i}] Source: {ctx['source']}\n{ctx['text']}")
    big_context = "\n\n".join(context_texts) if context_texts else ""
    user_content = f"CONTEXT:\n{big_context}\n\nQUESTION:\n{question}\n\nAnswer using only the CONTEXT. If not in context, say 'I don't know based on the provided materials.' Provide CITATIONS inline like [1]."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    return messages


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), retry=retry_if_exception_type(Exception))
def generate_answer(question: str, contexts: List[Dict[str, Any]], max_tokens: int = 512, temperature: float = 0.0) -> Dict[str, Any]:
    """
    Synchronous call to Groq Chat Completions.
    Returns a dict with 'text' and raw completion.
    """
    messages = build_messages(question, contexts)
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
