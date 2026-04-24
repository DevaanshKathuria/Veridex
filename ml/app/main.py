import os
import time

from fastapi import FastAPI

from app.cache import ping as redis_ping
from app.pipeline.extract_claims import ExtractRequest, extract_claims
from app.pipeline.ingest import IngestRequest, process_ingest


app = FastAPI(title="Veridex ML Service")


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
