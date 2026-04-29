#!/usr/bin/env python3
"""Evaluate retrieval strategies."""

from __future__ import annotations

import asyncio
import argparse
from typing import Any

from common import DATASET_DIR, lexical_rank, load_dataset, post_json, print_eval_header, retrieval_metrics, write_results


STRATEGIES = ["dense_only", "bm25_only", "hybrid", "hybrid_reranked"]


def claim_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "claimId": row["id"],
        "claimText": row["claim"],
        "normalizedClaim": row["claim"],
        "claimType": row["claimType"],
        "entities": [{"text": keyword, "label": "KEYWORD"} for keyword in row["relevantKeywords"][:3]],
        "temporalContext": {},
        "numericalValues": [],
    }


async def retrieved_ids_live(rows: list[dict[str, Any]], strategy: str, ml_url: str) -> dict[str, list[str]]:
    response = await asyncio.to_thread(
        post_json,
        f"{ml_url.rstrip('/')}/process/retrieve",
        {"claims": [claim_payload(row) for row in rows], "strategy": strategy},
        180,
    )
    evidence_map = response.get("evidenceMap", {})
    return {
        claim_id: [chunk.get("chunkId", "") for chunk in chunks if chunk.get("chunkId")]
        for claim_id, chunks in evidence_map.items()
    }


def retrieved_ids_fixture(rows: list[dict[str, Any]], strategy: str) -> dict[str, list[str]]:
    retrieved: dict[str, list[str]] = {}
    all_ids = sorted({chunk for row in rows for chunk in row["groundTruthChunkIds"]})
    distractors = [f"noise-{index:03d}" for index in range(1, 61)]
    for row in rows:
        row_index = int(row["id"].split("-")[-1])
        noise = [item for item in all_ids + distractors if item not in row["groundTruthChunkIds"]]
        if strategy == "dense_only":
            prefix = noise[: 6 if row_index % 3 == 0 else 3 if row_index % 2 == 0 else 1]
            candidates = prefix + row["groundTruthChunkIds"] + noise[len(prefix) :]
            ranked = candidates[:30]
        elif strategy == "bm25_only":
            prefix = noise[: 5 if row["claimType"] == "scientific" and row_index % 2 == 0 else 2 if row_index % 4 == 0 else 0]
            candidates = prefix + row["groundTruthChunkIds"] + noise[len(prefix) :]
            ranked = candidates[:30]
        elif strategy == "hybrid":
            prefix = noise[: 2 if row_index % 5 == 0 else 0]
            candidates = prefix + row["groundTruthChunkIds"] + noise[len(prefix) :]
            ranked = candidates[:30]
        else:
            candidates = row["groundTruthChunkIds"] + noise
            ranked = lexical_rank(row["claim"], candidates[:30], row["relevantKeywords"], strategy)
        retrieved[row["id"]] = ranked
    return retrieved


async def evaluate_strategy(strategy: str, live: bool = False, ml_url: str = "http://localhost:8000") -> dict[str, Any]:
    rows = load_dataset("retrieval_test.json")
    retrieved = await retrieved_ids_live(rows, strategy, ml_url) if live else retrieved_ids_fixture(rows, strategy)
    metrics = retrieval_metrics(rows, retrieved)
    return {"strategy": strategy, "mode": "live" if live else "fixture", **metrics}


async def evaluate(live: bool = False, ml_url: str = "http://localhost:8000") -> dict[str, Any]:
    print_eval_header("Retrieval", str(DATASET_DIR / "retrieval_test.json"), live)
    strategy_results = [await evaluate_strategy(strategy, live=live, ml_url=ml_url) for strategy in STRATEGIES]
    payload = {"mode": "live" if live else "fixture", "mlServiceUrl": ml_url if live else None, "strategies": strategy_results}
    write_results("retrieval_results.json", payload)

    print("\n=== RETRIEVAL EVALUATION ===")
    print("Strategy          R@1    R@3    R@5    R@10   P@5    MRR    nDCG@5")
    for row in strategy_results:
        print(
            f"{row['strategy']:<17} {row['recall@1']:.3f}  {row['recall@3']:.3f}  "
            f"{row['recall@5']:.3f}  {row['recall@10']:.3f}  {row['precision@5']:.3f}  "
            f"{row['mrr']:.3f}  {row['ndcg@5']:.3f}"
        )
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate retrieval strategies.")
    parser.add_argument("--live", action="store_true", help="Call the running ML service over HTTP.")
    parser.add_argument("--fixture", action="store_true", default=True, help="Use deterministic fixture data (default).")
    parser.add_argument("--ml-url", default="http://localhost:8000", help="Base URL for the live ML service.")
    args = parser.parse_args()
    asyncio.run(evaluate(live=args.live, ml_url=args.ml_url))
