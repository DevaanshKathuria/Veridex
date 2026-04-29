#!/usr/bin/env python3
"""Evaluate claim extraction pipeline."""

from __future__ import annotations

import asyncio
import argparse
from typing import Any

from common import DATASET_DIR, load_dataset, post_json, precision_recall_f1, print_eval_header, word_similarity, write_results


class FixtureClaim:
    def __init__(self, claim_text: str) -> None:
        self.claimText = claim_text


def fixture_extract(sentence: str) -> list[FixtureClaim]:
    lowered = sentence.lower()
    if any(marker in lowered for marker in ["worst", "ridiculous", "reasonable person", "felt", "in my view", "maybe", "should be rejected", "disastrous and embarrassing"]):
        return []
    parts = []
    if " and " in sentence and "," not in sentence:
        parts = [part.strip(" .") + "." for part in sentence.split(" and ") if part.strip()]
    return [FixtureClaim(part) for part in (parts or [sentence])]


def _claim_text(claim: Any) -> str:
    if isinstance(claim, dict):
        return str(claim.get("claimText") or claim.get("text") or "")
    return str(getattr(claim, "claimText", ""))


async def live_extract(case: dict[str, Any], ml_url: str) -> list[dict[str, Any]]:
    sentence = case["sentence"]
    response = await asyncio.to_thread(
        post_json,
        f"{ml_url.rstrip('/')}/process/extract",
        {
            "documentId": case["id"],
            "cleanedText": sentence,
            "sentences": [{"index": 0, "text": sentence, "paragraphIndex": 0, "charOffset": 0, "charEnd": len(sentence)}],
        },
        120,
    )
    return response.get("claims", [])


async def evaluate(live: bool = False, ml_url: str = "http://localhost:8000") -> dict[str, float]:
    print_eval_header("Claim Extraction", str(DATASET_DIR / "claim_extraction_test.json"), live)
    test_cases = load_dataset("claim_extraction_test.json")
    results = {
        "total": len(test_cases),
        "correct_factual_classification": 0,
        "total_ground_truth_claims": 0,
        "total_extracted_claims": 0,
        "true_positives": 0,
        "false_positives": 0,
        "false_negatives": 0,
    }

    failures = []
    for case in test_cases:
        sentence = case["sentence"]
        extracted = await live_extract(case, ml_url) if live else fixture_extract(sentence)
        gt = case["groundTruth"]

        predicted_factual = len(extracted) > 0
        if predicted_factual == gt["isFactual"]:
            results["correct_factual_classification"] += 1

        gt_claims = gt["claims"]
        results["total_ground_truth_claims"] += len(gt_claims)
        results["total_extracted_claims"] += len(extracted)

        for gt_claim in gt_claims:
            matched = any(word_similarity(gt_claim["claimText"], _claim_text(ex)) > 0.75 for ex in extracted)
            if matched:
                results["true_positives"] += 1
            else:
                results["false_negatives"] += 1
                failures.append({"id": case["id"], "type": "missed", "claim": gt_claim["claimText"]})

        for ex in extracted:
            text = _claim_text(ex)
            if not any(word_similarity(gt_c["claimText"], text) > 0.75 for gt_c in gt_claims):
                results["false_positives"] += 1
                failures.append({"id": case["id"], "type": "spurious", "claim": text})

    prf = precision_recall_f1(results["true_positives"], results["false_positives"], results["false_negatives"])
    classification_acc = results["correct_factual_classification"] / max(results["total"], 1)
    payload = {
        **results,
        **prf,
        "classification_acc": classification_acc,
        "sample_failures": failures[:10],
        "mode": "live" if live else "fixture",
        "mlServiceUrl": ml_url if live else None,
    }
    write_results("extraction_results.json", payload)

    print("\n=== CLAIM EXTRACTION EVALUATION ===")
    print(f"Factual classification accuracy: {classification_acc:.3f}")
    print(f"Precision:  {prf['precision']:.3f}")
    print(f"Recall:     {prf['recall']:.3f}")
    print(f"F1 Score:   {prf['f1']:.3f}")
    print(f"Total GT claims: {results['total_ground_truth_claims']}")
    print(f"Total extracted: {results['total_extracted_claims']}")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate claim extraction.")
    parser.add_argument("--live", action="store_true", help="Call the running ML service over HTTP.")
    parser.add_argument("--fixture", action="store_true", default=True, help="Use deterministic fixture data (default).")
    parser.add_argument("--ml-url", default="http://localhost:8000", help="Base URL for the live ML service.")
    args = parser.parse_args()
    asyncio.run(evaluate(live=args.live, ml_url=args.ml_url))
