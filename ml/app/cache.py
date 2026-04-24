import json
import os
from hashlib import sha256
from typing import Any

import redis.asyncio as redis_async


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis = redis_async.from_url(REDIS_URL)


def _hash_key(prefix: str, value: str, suffix: str | None = None) -> str:
    base = f"{prefix}:{sha256(value.encode()).hexdigest()}"
    return f"{base}:{suffix}" if suffix else base


async def get_embedding_cache(text: str) -> list[float] | None:
    key = _hash_key("emb", text)
    val = await redis.get(key)
    return json.loads(val) if val else None


async def set_embedding_cache(text: str, vector: list[float]) -> None:
    key = _hash_key("emb", text)
    await redis.setex(key, 604800, json.dumps(vector))


async def get_retrieval_cache(normalized_claim: str, strategy: str) -> list[Any] | None:
    key = _hash_key("ret", normalized_claim, strategy)
    val = await redis.get(key)
    return json.loads(val) if val else None


async def set_retrieval_cache(normalized_claim: str, strategy: str, chunks: list[Any]) -> None:
    key = _hash_key("ret", normalized_claim, strategy)
    await redis.setex(key, 86400, json.dumps(chunks))


async def get_norm_cache(raw_claim: str) -> str | None:
    key = _hash_key("norm", raw_claim)
    val = await redis.get(key)
    return val.decode() if val else None


async def set_norm_cache(raw_claim: str, normalized: str) -> None:
    key = _hash_key("norm", raw_claim)
    await redis.setex(key, 604800, normalized)


async def get_analysis_cache(cleaned_text: str) -> dict[str, Any] | None:
    key = _hash_key("analysis", cleaned_text)
    val = await redis.get(key)
    return json.loads(val) if val else None


async def set_analysis_cache(cleaned_text: str, result: dict[str, Any]) -> None:
    key = _hash_key("analysis", cleaned_text)
    await redis.setex(key, 21600, json.dumps(result))


async def ping() -> bool:
    try:
        await redis.ping()
        return True
    except Exception:
        return False
