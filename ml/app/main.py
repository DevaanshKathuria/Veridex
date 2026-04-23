from fastapi import FastAPI


app = FastAPI(title="Veridex ML Service")


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "models_loaded": False,
    }
