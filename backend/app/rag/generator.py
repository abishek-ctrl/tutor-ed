from typing import List, Dict, Any
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging
from app.core.config import settings

logger = logging.getLogger("rag.generator")
client = Groq(api_key=settings.groq_api_key)

BASE_SYSTEM_PROMPT = """
You are Momo, an expert AI tutor for undergraduate STEM topics. Your personality is friendly, encouraging, and knowledgeable. Your goal is to help students understand complex topics by explaining concepts clearly and concisely.

You must strictly adhere to the following rules:
1.  Use ONLY the provided CONTEXT. Do not use any external knowledge or information that is not explicitly present in the context provided.
2.  If the answer is not in the CONTEXT, you must respond with: "I'm sorry, but I cannot answer that question based on the materials provided. Please try asking something else related to the documents you've uploaded."
3.  Do NOT include citation markers like `[1]`, `[2]`, etc., in your response. The response should be a clean, readable text without any references to the source numbers.
4.  Your answers should be structured and easy to read. Use formatting like paragraphs and bullet points where appropriate to break down complex information.
5.  Maintain a positive and supportive tone throughout the conversation.
"""

CONCISE_INSTRUCTION = "Answer concisely in 1–3 short sentences. Be direct and to the point."

def build_messages(question: str, contexts: List[Dict[str, Any]], short_answer: bool = False) -> List[Dict[str, str]]:
    context_texts = []
    for i, ctx in enumerate(contexts, start=1):
        context_texts.append(f"Source: {ctx.get('source','unknown')}\n{ctx.get('text','')}")
    big_context = "\n\n".join(context_texts) if context_texts else ""
    user_content = f"CONTEXT:\n---\n{big_context}\n---\n\nQUESTION:\n{question}\n\nBased *only* on the context provided, please provide a clear and accurate answer. Do not include citation markers."
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
            max_tokens=max_tokens,
            stream=False,
        )
        content = completion.choices[0].message.content
        return {"text": content, "raw": completion}
    except Exception as e:
        logger.exception("Groq generation failed.")
        raise