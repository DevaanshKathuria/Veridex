import os
import time

from elasticsearch import AsyncElasticsearch
from fastapi import FastAPI

from app.cache import ping as redis_ping
from app.pipeline.extract_claims import ExtractRequest, extract_claims
from app.pipeline.ingest import IngestRequest, process_ingest
from app.pipeline.retrieve import RetrieveRequest, retrieve_evidence
from app.pipeline.verify import VerifyRequest, verify_claims


app = FastAPI(title="Veridex ML Service")
ELASTICSEARCH_URL = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")
EVIDENCE_INDEX_NAME = "veridex-evidence"


@app.on_event("startup")
async def ensure_elasticsearch_index() -> None:
    es = AsyncElasticsearch([ELASTICSEARCH_URL])
    try:
        exists = await es.indices.exists(index=EVIDENCE_INDEX_NAME)
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
