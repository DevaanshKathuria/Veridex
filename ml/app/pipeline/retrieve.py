from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, TYPE_CHECKING

import numpy as np
from elasticsearch import AsyncElasticsearch
from pinecone import Pinecone
from pydantic import BaseModel, Field

from app.cache import (
    get_embedding_cache,
    get_retrieval_cache,
    set_embedding_cache,
    set_retrieval_cache,
)

if TYPE_CHECKING:
    from sentence_transformers import CrossEncoder, SentenceTransformer


ELASTICSEARCH_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "veridex-kb")


def _load_dense_model() -> SentenceTransformer | None:
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _load_reranker() -> CrossEncoder | None:
    try:
        from sentence_transformers import CrossEncoder

        return CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    except Exception:
        return None


def _load_nli_pipeline() -> Any:
    try:
        from transformers import pipeline as hf_pipeline

        return hf_pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
    except Exception:
        return None


dense_model: "SentenceTransformer | None" = None
reranker: "CrossEncoder | None" = None
nli_pipeline: Any = None
_dense_model_loaded = False
_reranker_loaded = False
_nli_pipeline_loaded = False


def _get_dense_model() -> SentenceTransformer | None:
    global dense_model, _dense_model_loaded
    if not _dense_model_loaded:
        dense_model = _load_dense_model()
        _dense_model_loaded = True
    return dense_model


def _get_reranker() -> CrossEncoder | None:
    global reranker, _reranker_loaded
    if not _reranker_loaded:
        reranker = _load_reranker()
        _reranker_loaded = True
    return reranker


def _get_nli_pipeline() -> Any:
    global nli_pipeline, _nli_pipeline_loaded
    if not _nli_pipeline_loaded:
        nli_pipeline = _load_nli_pipeline()
        _nli_pipeline_loaded = True
    return nli_pipeline


class EvidenceChunkDTO(BaseModel):
    chunkId: str
    chunkText: str
    source: str
    sourceType: str
    sourceUrl: str
    reliabilityTier: int
    publicationDate: str | None
    denseScore: float
    bm25Score: float
    rrfScore: float
    rerankerScore: float
    nliStance: str
    nliConfidence: float
    highlightSpans: list[dict[str, int]] = Field(default_factory=list)


class RetrieveRequest(BaseModel):
    claims: list[dict[str, Any]]
    strategy: str = "hybrid_reranked"
    claimDate: str | None = None
    windowDays: int = 365


class RetrieveResponse(BaseModel):
    evidenceMap: dict[str, list[EvidenceChunkDTO]]
    latencyMs: float
    strategyUsed: str


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _build_pinecone_filter(claim: dict[str, Any], req: RetrieveRequest) -> dict[str, Any]:
    filter_dict: dict[str, Any] = {"language": {"$eq": "en"}}
    normalized_date = claim.get("temporalContext", {}).get("normalizedDate") or req.claimDate
    parsed = _parse_date(normalized_date)
    if not parsed:
        return filter_dict

    start_date = (parsed - timedelta(days=req.windowDays)).date().isoformat()
    end_date = (parsed + timedelta(days=req.windowDays)).date().isoformat()
    filter_dict["publicationDate"] = {"$gte": start_date, "$lte": end_date}
    return filter_dict


async def _encode_text(text: str) -> list[float]:
    cached = await get_embedding_cache(text)
    if cached:
        return cached

    model = _get_dense_model()
    if model is None:
        return []

    vector = await asyncio.to_thread(model.encode, text)
    if hasattr(vector, "tolist"):
        encoded = vector.tolist()
    else:
        encoded = list(vector)
    await set_embedding_cache(text, encoded)
    return encoded


async def _pinecone_query(claim_text: str, claim: dict[str, Any], req: RetrieveRequest) -> list[dict[str, Any]]:
    if not PINECONE_API_KEY or not PINECONE_INDEX_NAME:
        return []

    embedding = await _encode_text(claim_text)
    if not embedding:
        return []

    filter_dict = {}
    if claim.get("temporalContext", {}).get("normalizedDate") and req.strategy != "dense_only":
        filter_dict = _build_pinecone_filter(claim, req)

    def run_query() -> Any:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX_NAME)
        return index.query(
            vector=embedding,
            top_k=15,
            include_metadata=True,
            filter=filter_dict or None,
            namespace="kb-v1",
        )

    try:
        results = await asyncio.to_thread(run_query)
    except Exception:
        return []

    dense_results: list[dict[str, Any]] = []
    for i, match in enumerate(getattr(results, "matches", []) or []):
        metadata = getattr(match, "metadata", {}) or {}
        dense_results.append(
            {
                "chunkId": getattr(match, "id", ""),
                "chunkText": metadata.get("chunkText", ""),
                "source": metadata.get("source", ""),
                "sourceType": metadata.get("sourceType", ""),
                "sourceUrl": metadata.get("sourceUrl", ""),
                "reliabilityTier": int(metadata.get("reliabilityTier", 4)),
                "publicationDate": metadata.get("publicationDate"),
                "denseScore": float(getattr(match, "score", 0.0) or 0.0),
                "bm25Score": 0.0,
                "rank": i + 1,
            }
        )
    return dense_results


async def _bm25_query(claim_text: str, claim: dict[str, Any]) -> list[dict[str, Any]]:
    es_query: dict[str, Any] = {
        "query": {
            "bool": {
                "must": [{"multi_match": {"query": claim_text, "fields": ["chunkText"]}}],
                "filter": [{"term": {"language": "en"}}],
            }
        },
        "size": 15,
    }

    entities = claim.get("entities", [])
    if entities:
        entity_texts = [entity["text"] for entity in entities[:3] if entity.get("text")]
        if entity_texts:
            es_query["query"]["bool"]["should"] = [{"match": {"chunkText": entity_text}} for entity_text in entity_texts]
            es_query["query"]["bool"]["minimum_should_match"] = 0

    try:
        async with AsyncElasticsearch([ELASTICSEARCH_URL]) as es:
            es_results = await es.search(index="veridex-evidence", body=es_query)
    except Exception:
        return []

    bm25_results: list[dict[str, Any]] = []
    for i, hit in enumerate(es_results.get("hits", {}).get("hits", [])):
        source = hit.get("_source", {})
        bm25_results.append(
            {
                "chunkId": hit.get("_id", ""),
                "chunkText": source.get("chunkText", ""),
                "source": source.get("source", ""),
                "sourceType": source.get("sourceType", ""),
                "sourceUrl": source.get("sourceUrl", ""),
                "reliabilityTier": int(source.get("reliabilityTier", 4)),
                "publicationDate": source.get("publicationDate"),
                "denseScore": 0.0,
                "bm25Score": float(hit.get("_score", 0.0) or 0.0),
                "rank": i + 1,
            }
        )
    return bm25_results


def _fuse_results(
    dense_results: list[dict[str, Any]], bm25_results: list[dict[str, Any]], strategy: str
) -> list[dict[str, Any]]:
    if strategy not in {"hybrid", "hybrid_reranked"}:
        return (dense_results if strategy == "dense_only" else bm25_results)[:20]

    all_chunks: dict[str, dict[str, Any]] = {}
    k = 60
    for chunk in dense_results:
        chunk_id = chunk["chunkId"]
        if chunk_id not in all_chunks:
            all_chunks[chunk_id] = {**chunk, "rrfScore": 0.0}
        all_chunks[chunk_id]["rrfScore"] += 1.0 / (k + chunk["rank"])

    for chunk in bm25_results:
        chunk_id = chunk["chunkId"]
        if chunk_id not in all_chunks:
            all_chunks[chunk_id] = {**chunk, "rrfScore": 0.0}
        else:
            all_chunks[chunk_id].update(
                {
                    "bm25Score": chunk["bm25Score"],
                    "sourceType": all_chunks[chunk_id].get("sourceType") or chunk["sourceType"],
                    "sourceUrl": all_chunks[chunk_id].get("sourceUrl") or chunk["sourceUrl"],
                    "publicationDate": all_chunks[chunk_id].get("publicationDate") or chunk["publicationDate"],
                }
            )
        all_chunks[chunk_id]["rrfScore"] += 1.0 / (k + chunk["rank"])

    return sorted(all_chunks.values(), key=lambda item: item["rrfScore"], reverse=True)[:20]


async def _rerank_chunks(claim_text: str, chunks: list[dict[str, Any]], strategy: str) -> list[dict[str, Any]]:
    active_reranker = _get_reranker() if strategy == "hybrid_reranked" and chunks else None
    if active_reranker is not None:
        pairs = [(claim_text, chunk["chunkText"]) for chunk in chunks]
        try:
            scores = await asyncio.to_thread(active_reranker.predict, pairs)
        except Exception:
            scores = [chunk.get("rrfScore") or chunk.get("denseScore") or chunk.get("bm25Score", 0.0) for chunk in chunks]

        for index, chunk in enumerate(chunks):
            chunk["rerankerScore"] = float(scores[index])
        chunks.sort(key=lambda item: item["rerankerScore"], reverse=True)
        return chunks

    for chunk in chunks:
        chunk["rerankerScore"] = float(chunk.get("denseScore") or chunk.get("bm25Score") or chunk.get("rrfScore", 0.0))
    return chunks


async def _diversify_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    active_dense_model = _get_dense_model() if chunks else None
    if active_dense_model is None:
        return chunks[:6]

    selected: list[dict[str, Any]] = []
    selected_embeddings: list[np.ndarray] = []

    for chunk in chunks:
        try:
            embedding = await asyncio.to_thread(active_dense_model.encode, chunk["chunkText"])
        except Exception:
            selected.append(chunk)
            if len(selected) == 6:
                break
            continue

        emb = np.array(embedding, dtype=np.float32)
        too_similar = False
        for selected_embedding in selected_embeddings:
            denominator = float(np.linalg.norm(emb) * np.linalg.norm(selected_embedding))
            if denominator == 0:
                continue
            cosine_similarity = float(np.dot(emb, selected_embedding) / denominator)
            if cosine_similarity > 0.85:
                too_similar = True
                break

        if not too_similar:
            selected.append(chunk)
            selected_embeddings.append(emb)
        if len(selected) == 6:
            break

    return selected


async def _apply_nli(claim_text: str, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not chunks:
        return chunks

    active_nli_pipeline = _get_nli_pipeline()
    if active_nli_pipeline is None:
        for chunk in chunks:
            chunk["nliStance"] = "neutral"
            chunk["nliConfidence"] = 0.0
            chunk["highlightSpans"] = []
        return chunks

    for chunk in chunks:
        try:
            result = await asyncio.to_thread(
                active_nli_pipeline,
                chunk["chunkText"],
                candidate_labels=["entailment", "contradiction", "neutral"],
                hypothesis_template="This evidence {} the claim: " + claim_text,
            )
            labels = result.get("labels", [])
            scores = result.get("scores", [])
            label_scores = dict(zip(labels, scores))
            top_label = labels[0] if labels else "neutral"
            chunk["nliStance"] = top_label
            chunk["nliConfidence"] = float(label_scores.get(top_label, 0.0))
        except Exception:
            chunk["nliStance"] = "neutral"
            chunk["nliConfidence"] = 0.0
        chunk["highlightSpans"] = []

    return chunks


async def retrieve_evidence(req: RetrieveRequest) -> RetrieveResponse:
    async def retrieve_for_claim(claim: dict[str, Any]) -> tuple[str, list[EvidenceChunkDTO]]:
        claim_id = str(claim["claimId"])
        claim_text = str(claim.get("normalizedClaim") or claim.get("claimText") or "")

        cached = await get_retrieval_cache(claim_text, req.strategy)
        if cached:
            return claim_id, [EvidenceChunkDTO(**chunk) for chunk in cached]

        dense_results: list[dict[str, Any]] = []
        bm25_results: list[dict[str, Any]] = []

        if req.strategy in {"dense_only", "hybrid", "hybrid_reranked"}:
            dense_results = await _pinecone_query(claim_text, claim, req)

        if req.strategy in {"bm25_only", "hybrid", "hybrid_reranked"}:
            bm25_results = await _bm25_query(claim_text, claim)

        fused = _fuse_results(dense_results, bm25_results, req.strategy)
        fused = await _rerank_chunks(claim_text, fused, req.strategy)
        selected = await _diversify_chunks(fused)
        selected = await _apply_nli(claim_text, selected)

        evidence_chunks = [
            EvidenceChunkDTO(
                **{
                    **chunk,
                    "rrfScore": float(chunk.get("rrfScore", 0.0)),
                    "highlightSpans": chunk.get("highlightSpans", []),
                }
            )
            for chunk in selected
        ]
        await set_retrieval_cache(claim_text, req.strategy, [chunk.model_dump() for chunk in evidence_chunks])
        return claim_id, evidence_chunks

    start = time.time()
    results = await asyncio.gather(*[retrieve_for_claim(claim) for claim in req.claims])
    evidence_map = {claim_id: chunks for claim_id, chunks in results}
    return RetrieveResponse(
        evidenceMap=evidence_map,
        latencyMs=(time.time() - start) * 1000,
        strategyUsed=req.strategy,
    )
