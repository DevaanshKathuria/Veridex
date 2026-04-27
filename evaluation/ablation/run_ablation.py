#!/usr/bin/env python3
"""Run retrieval and verification ablations."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from common import load_dataset, write_results  # noqa: E402
from eval_retrieval import STRATEGIES, evaluate_strategy  # noqa: E402
from eval_verification import evaluate as evaluate_verification  # noqa: E402


async def evaluate() -> dict:
    rows = []
    for strategy in STRATEGIES:
        retrieval = await evaluate_strategy(strategy)
        verification = await evaluate_verification(limit=10, write=False, verbose=False)
        rows.append(
            {
                "strategy": strategy,
                "recall@5": retrieval["recall@5"],
                "mrr": retrieval["mrr"],
                "ndcg@5": retrieval["ndcg@5"],
                "verifyAcc": verification["accuracy"],
                "usedFallbackRanking": retrieval["usedFallbackRanking"],
            }
        )

    dense = next(row for row in rows if row["strategy"] == "dense_only")
    best = max(rows, key=lambda row: row["recall@5"])
    improvement = {
        "bestStrategy": best["strategy"],
        "recallAt5ImprovementPct": ((best["recall@5"] - dense["recall@5"]) / max(dense["recall@5"], 1e-9)) * 100,
        "mrrImprovementPct": ((best["mrr"] - dense["mrr"]) / max(dense["mrr"], 1e-9)) * 100,
    }
    payload = {"rows": rows, "improvement": improvement, "datasetSize": len(load_dataset("retrieval_test.json"))}
    write_results("ablation_results.json", payload)

    print("\n=== RETRIEVAL ABLATION ===")
    print("Strategy             | Recall@5 | MRR   | nDCG@5 | Verify Acc")
    for row in rows:
        print(
            f"{row['strategy']:<20} | {row['recall@5']:.3f}    | {row['mrr']:.3f} | "
            f"{row['ndcg@5']:.3f}  | {row['verifyAcc']:.2f}"
        )
    print(
        f"Improvement ({best['strategy']} vs dense): "
        f"+{improvement['recallAt5ImprovementPct']:.1f}% Recall@5, "
        f"+{improvement['mrrImprovementPct']:.1f}% MRR"
    )
    return payload


if __name__ == "__main__":
    asyncio.run(evaluate())
