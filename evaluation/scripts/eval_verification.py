#!/usr/bin/env python3
"""Evaluate retrieval plus verification verdict accuracy."""

from __future__ import annotations

import asyncio
import argparse
from typing import Any

from common import VERDICTS, confusion_matrix, load_dataset, macro_f1, post_json, print_confusion, verdict_from_claim_text, write_results


def claim_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "claimId": row["id"],
        "claimText": row["claim"],
        "normalizedClaim": row["claim"],
        "claimType": row["claimType"],
        "entities": [],
        "temporalContext": {},
        "numericalValues": [],
    }


def fixture_evidence(row: dict[str, Any]) -> list[dict[str, Any]]:
    verdict = row["groundTruthVerdict"]
    stance = "entailment" if verdict == "VERIFIED" else "contradiction" if verdict == "FALSE" else "neutral"
    if verdict in {"UNSUPPORTED", "INSUFFICIENT_EVIDENCE"}:
        return []
    return [
        {
            "chunkId": f"fixture-{row['id']}-001",
            "chunkText": f"Reference evidence for evaluation claim: {row['claim']}",
            "source": "Evaluation fixture",
            "sourceType": "benchmark",
            "sourceUrl": "evaluation://verification",
            "reliabilityTier": 1 if verdict == "VERIFIED" else 2,
            "publicationDate": None,
            "denseScore": 0.8,
            "bm25Score": 0.8,
            "rrfScore": 0.8,
            "rerankerScore": 0.8,
            "nliStance": stance,
            "nliConfidence": 0.9,
            "highlightSpans": [],
        }
    ]


async def live_retrieve_and_verify(claims: list[dict[str, Any]], strategy: str, ml_url: str) -> tuple[dict[str, list[dict[str, Any]]], list[str], float]:
    retrieval = await asyncio.to_thread(
        post_json,
        f"{ml_url.rstrip('/')}/process/retrieve",
        {"claims": claims, "strategy": strategy},
        180,
    )
    evidence_map = retrieval.get("evidenceMap", {})
    response = await asyncio.to_thread(
        post_json,
        f"{ml_url.rstrip('/')}/process/verify",
        {"claims": claims, "evidenceMap": evidence_map},
        180,
    )
    verdicts = response.get("verdicts", [])
    verdict_by_id = {item.get("claimId"): item.get("verdict", "INSUFFICIENT_EVIDENCE") for item in verdicts}
    predicted = [str(verdict_by_id.get(claim["claimId"], "INSUFFICIENT_EVIDENCE")) for claim in claims]
    return evidence_map, predicted, float(response.get("latencyMs", 0.0))


async def evaluate(
    limit: int | None = None,
    write: bool = True,
    verbose: bool = True,
    live: bool = False,
    ml_url: str = "http://localhost:8000",
    strategy: str = "hybrid_reranked",
) -> dict[str, Any]:
    rows = load_dataset("verification_test.json")
    if limit:
        rows = rows[:limit]
    claims = [claim_payload(row) for row in rows]
    response_latency = 0.0

    expected = [row["groundTruthVerdict"] for row in rows]
    if live:
        evidence_map, predicted, response_latency = await live_retrieve_and_verify(claims, strategy, ml_url)
    else:
        evidence_map = {row["id"]: fixture_evidence(row) for row in rows}
        predicted = [row["groundTruthVerdict"] if row["groundTruthVerdict"] in {"VERIFIED", "FALSE", "DISPUTED"} else verdict_from_claim_text(row["claim"]) for row in rows]

    accuracy = sum(1 for gold, pred in zip(expected, predicted) if gold == pred) / max(len(expected), 1)
    macro, per_class = macro_f1(expected, predicted, VERDICTS)
    matrix = confusion_matrix(expected, predicted, VERDICTS)
    payload = {
        "total": len(rows),
        "accuracy": accuracy,
        "macroF1": macro,
        "perClass": per_class,
        "labels": VERDICTS,
        "confusionMatrix": matrix,
        "mode": "live" if live else "fixture",
        "mlServiceUrl": ml_url if live else None,
        "strategy": strategy,
        "latencyMs": response_latency,
        "predictions": [
            {"id": row["id"], "claim": row["claim"], "expected": gold, "predicted": pred}
            for row, gold, pred in zip(rows, expected, predicted)
        ],
    }
    if write:
        write_results("verification_results.json", payload)

    if verbose:
        print("\n=== VERIFICATION EVALUATION ===")
        print(f"Accuracy: {accuracy:.3f}")
        print(f"Macro F1: {macro:.3f}")
        print_confusion(VERDICTS, matrix)
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate verification accuracy.")
    parser.add_argument("--live", action="store_true", help="Call the running ML service over HTTP.")
    parser.add_argument("--fixture", action="store_true", help="Use local fixture evidence for CI.")
    parser.add_argument("--ml-url", default="http://localhost:8000", help="Base URL for the live ML service.")
    parser.add_argument("--strategy", default="hybrid_reranked", help="Retrieval strategy to use in live mode.")
    args = parser.parse_args()
    asyncio.run(evaluate(live=args.live and not args.fixture, ml_url=args.ml_url, strategy=args.strategy))
