#!/usr/bin/env python3
"""Evaluate latency from persisted PerformanceLog entries."""

from __future__ import annotations

import os
import argparse
from datetime import UTC, datetime

from common import DATASET_DIR, percentile, print_eval_header, write_results


def fixture_logs() -> list[dict]:
    return [
        {
            "totalLatencyMs": 13800 + i * 47,
            "retrievalLatencyMs": 4200 + i * 13,
            "judgmentLatencyMs": 5200 + i * 19,
            "cacheHitRate": 0.18 + (i % 7) * 0.04,
            "openaiTokensUsed": 1800 + i * 11,
            "createdAt": datetime.now(UTC),
        }
        for i in range(80)
    ]


def fetch_logs(live: bool) -> tuple[list[dict], bool]:
    if not live:
        return fixture_logs(), True

    try:
        from pymongo import MongoClient
    except Exception:
        return fixture_logs(), True

    try:
        client = MongoClient(os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017/veridex"), serverSelectionTimeoutMS=1500)
        client.admin.command("ping")
        db = client.get_default_database() if client.get_default_database().name else client["veridex"]
        rows = list(db["performancelogs"].find({}, {"_id": 0}).sort("createdAt", -1).limit(500))
        return rows or fixture_logs(), not bool(rows)
    except Exception:
        return fixture_logs(), True


def evaluate(live: bool = False, ml_url: str = "http://localhost:8000") -> dict:
    print_eval_header("Latency", str(DATASET_DIR / "PerformanceLog collection"), live)
    logs, used_fixture = fetch_logs(live)
    total = [float(row.get("totalLatencyMs", 0)) for row in logs]
    retrieval = [float(row.get("retrievalLatencyMs", 0)) for row in logs]
    judgment = [float(row.get("judgmentLatencyMs", 0)) for row in logs]
    cache = [float(row.get("cacheHitRate", 0)) for row in logs]
    tokens = sum(float(row.get("openaiTokensUsed", 0)) for row in logs)
    payload = {
        "sampleSize": len(logs),
        "mode": "live" if live else "fixture",
        "mlServiceUrl": ml_url if live else None,
        "usedFixtureData": used_fixture,
        "totalLatencyMs": {"p50": percentile(total, 0.5), "p95": percentile(total, 0.95)},
        "retrievalLatencyMs": {"p50": percentile(retrieval, 0.5), "p95": percentile(retrieval, 0.95)},
        "judgmentLatencyMs": {"p50": percentile(judgment, 0.5), "p95": percentile(judgment, 0.95)},
        "meanCacheHitRate": sum(cache) / max(len(cache), 1),
        "openaiTokensUsed": int(tokens),
        "estimatedCostUsd": tokens * 0.000005,
        "throughputAnalysesPerHour": len(logs),
    }
    write_results("latency_results.json", payload)

    print("\n=== LATENCY EVALUATION ===")
    print("Metric              p50 ms   p95 ms")
    print(f"Total latency       {payload['totalLatencyMs']['p50']:.0f}    {payload['totalLatencyMs']['p95']:.0f}")
    print(f"Retrieval latency   {payload['retrievalLatencyMs']['p50']:.0f}     {payload['retrievalLatencyMs']['p95']:.0f}")
    print(f"Judgment latency    {payload['judgmentLatencyMs']['p50']:.0f}     {payload['judgmentLatencyMs']['p95']:.0f}")
    print(f"Mean cache hit rate: {payload['meanCacheHitRate']:.3f}")
    print(f"Estimated OpenAI cost: ${payload['estimatedCostUsd']:.4f}")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate latency from PerformanceLog entries.")
    parser.add_argument("--live", action="store_true", help="Call real services and read MongoDB PerformanceLog data.")
    parser.add_argument("--fixture", action="store_true", default=True, help="Use deterministic fixture data (default).")
    parser.add_argument("--ml-url", default="http://localhost:8000", help="ML service URL for --live mode.")
    args = parser.parse_args()
    evaluate(live=args.live, ml_url=args.ml_url)
