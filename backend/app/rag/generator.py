from typing import List, Dict, Any
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
import json
from app.core.config import settings

logger = logging.getLogger("rag.generator")
client = Groq(api_key=settings.groq_api_key)


SYSTEM_PROMPT = """
You are an expert step-by-step tutor for undergraduate STEM topics. Use only the information explicitly provided in the 'context' sections below for factual claims. If the answer is not supported by the provided context, say you don't know and suggest how the user could find the answer. Provide concise, structured explanations, and when appropriate, include short worked examples. Always return plain text (no markdown code fences). At the end include a 'CITATIONS:' section with numbered references used from context, e.g. [1], [2].
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
