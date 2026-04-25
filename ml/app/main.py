import asyncio
import os
import time

from elasticsearch import AsyncElasticsearch
from fastapi import FastAPI

from app.cache import ping as redis_ping
from app.pipeline.extract_claims import ExtractRequest, extract_claims
from app.pipeline.ingest import IngestRequest, process_ingest
from app.pipeline.manipulation import ManipulationRequest, detect_manipulation
from app.pipeline.retrieve import RetrieveRequest, retrieve_evidence
from app.pipeline.score import ScoreRequest, calculate_score, write_weights
from app.pipeline.verify import VerifyRequest, verify_claims


app = FastAPI(title="Veridex ML Service")
ELASTICSEARCH_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
EVIDENCE_INDEX_NAME = "veridex-evidence"


@app.on_event("startup")
async def ensure_elasticsearch_index() -> None:
    es = AsyncElasticsearch([ELASTICSEARCH_URL])
    try:
        exists = False
        last_error: Exception | None = None
        for _ in range(12):
            try:
                exists = await es.indices.exists(index=EVIDENCE_INDEX_NAME)
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                await asyncio.sleep(5)
        if last_error:
            raise last_error

        if not exists:
            await es.indices.create(
                index=EVIDENCE_INDEX_NAME,
                body={
                    "mappings": {
                        "properties": {
                            "chunkId": {"type": "keyword"},
                            "chunkText": {"type": "text", "analyzer": "english"},
                            "source": {"type": "keyword"},
                            "sourceType": {"type": "keyword"},
                            "sourceUrl": {"type": "keyword"},
                            "reliabilityTier": {"type": "integer"},
                            "publicationDate": {"type": "date"},
                            "topicTags": {"type": "keyword"},
                            "language": {"type": "keyword"},
                        }
                    }
                },
            )
    finally:
        await es.close()


@app.get("/health")
async def health() -> dict[str, object]:
    redis_ok = await redis_ping()
    return {
        "status": "ok",
        "redis": redis_ok,
        "models_loaded": True,
        "pipeline_version": os.environ.get("PIPELINE_VERSION", "1.0.0"),
    }


@app.post("/process/ingest")
async def ingest_endpoint(req: IngestRequest) -> dict[str, object]:
    start = time.time()
    result = await process_ingest(req)
    result_dict = result.model_dump()
    result_dict["latencyMs"] = (time.time() - start) * 1000
    return result_dict


@app.post("/process/extract")
async def extract_endpoint(req: ExtractRequest):
    return await extract_claims(req)


@app.post("/process/retrieve")
async def retrieve_endpoint(req: RetrieveRequest):
    return await retrieve_evidence(req)


@app.post("/process/verify")
async def verify_endpoint(req: VerifyRequest):
    return await verify_claims(req)


@app.post("/process/manipulate")
async def manipulate_endpoint(req: ManipulationRequest):
    return await detect_manipulation(req)


@app.post("/process/score")
async def score_endpoint(req: ScoreRequest):
    return await calculate_score(req)


@app.post("/config/scoring-weights")
async def update_weights(weights: dict):
    write_weights(weights)
    return {"updated": True}
