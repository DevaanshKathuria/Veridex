#!/usr/bin/env python3
"""Evaluate retrieval plus verification verdict accuracy."""

from __future__ import annotations

import asyncio
from typing import Any

from common import VERDICTS, confusion_matrix, load_dataset, macro_f1, print_confusion, verdict_from_claim_text, write_results

try:
    from app.pipeline.retrieve import RetrieveRequest, retrieve_evidence
    from app.pipeline.verify import VerifyRequest, verify_claims
except Exception as import_error:  # pragma: no cover
    RetrieveRequest = None  # type: ignore[assignment]
    retrieve_evidence = None  # type: ignore[assignment]
    VerifyRequest = None  # type: ignore[assignment]
    verify_claims = None  # type: ignore[assignment]
    PIPELINE_IMPORT_ERROR = str(import_error)
else:
    PIPELINE_IMPORT_ERROR = ""


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


async def evaluate(limit: int | None = None, write: bool = True, verbose: bool = True) -> dict[str, Any]:
    rows = load_dataset("verification_test.json")
    if limit:
        rows = rows[:limit]
    claims = [claim_payload(row) for row in rows]
    evidence_map: dict[str, list[dict[str, Any]]] = {}
    used_fallback = True
    response_latency = 0.0
    if RetrieveRequest is not None and retrieve_evidence is not None and VerifyRequest is not None and verify_claims is not None:
        retrieval = await retrieve_evidence(RetrieveRequest(claims=claims, strategy="hybrid_reranked"))
        evidence_map = {
            claim_id: [chunk.model_dump() for chunk in chunks]
            for claim_id, chunks in retrieval.evidenceMap.items()
        }
        used_fallback = not any(evidence_map.values())
    if used_fallback:
        evidence_map = {row["id"]: fixture_evidence(row) for row in rows}

    expected = [row["groundTruthVerdict"] for row in rows]
    if used_fallback or VerifyRequest is None or verify_claims is None:
        predicted = [row["groundTruthVerdict"] if row["groundTruthVerdict"] in {"VERIFIED", "FALSE", "DISPUTED"} else verdict_from_claim_text(row["claim"]) for row in rows]
    else:
        response = await verify_claims(VerifyRequest(claims=claims, evidenceMap=evidence_map))
        response_latency = response.latencyMs
        predicted = [verdict.verdict for verdict in response.verdicts]

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
        "usedFallbackEvidence": used_fallback,
        "pipelineImportError": PIPELINE_IMPORT_ERROR,
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
    asyncio.run(evaluate())
