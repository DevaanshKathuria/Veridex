import os
import time

import httpx
import numpy as np
from openai import OpenAI


AI_API_KEY = os.environ.get("AI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
AI_BASE_URL = os.environ.get("AI_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "gpt-4o")
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "openai").lower()
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSIONS = int(os.environ.get("EMBEDDING_DIMENSIONS", "384"))


def create_ai_client() -> OpenAI | None:
    if not AI_API_KEY:
        return None

    options: dict[str, str] = {"api_key": AI_API_KEY}
    if AI_BASE_URL:
        options["base_url"] = AI_BASE_URL
    return OpenAI(**options)


def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float] | None:
    if not AI_API_KEY:
        return None

    if EMBEDDING_PROVIDER == "gemini":
        model = EMBEDDING_MODEL.removeprefix("models/")
        response: httpx.Response | None = None
        for attempt in range(5):
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
                headers={"x-goog-api-key": AI_API_KEY},
                json={
                    "model": f"models/{model}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                    "outputDimensionality": EMBEDDING_DIMENSIONS,
                },
                timeout=30.0,
            )
            if response.status_code != 429 and response.status_code < 500:
                break
            retry_after = float(response.headers.get("retry-after", 0) or 0)
            time.sleep(retry_after or min(2**attempt, 16))

        if response is None:
            return None
        response.raise_for_status()
        values = response.json()["embedding"]["values"]

        # gemini-embedding-001 needs manual normalization when truncated below
        # its native 3072 dimensions.
        vector = np.asarray(values, dtype=float)
        norm = float(np.linalg.norm(vector))
        if norm:
            vector /= norm
        return vector.tolist()

    client = create_ai_client()
    if client is None:
        return None
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
        dimensions=EMBEDDING_DIMENSIONS,
    )
    return list(response.data[0].embedding)
