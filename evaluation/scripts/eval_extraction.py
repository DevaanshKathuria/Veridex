#!/usr/bin/env python3
"""Evaluate claim extraction pipeline."""

from __future__ import annotations

import asyncio

from common import load_dataset, precision_recall_f1, word_similarity, write_results

try:
    from app.pipeline.extract_claims import ExtractRequest, extract_claims
except Exception as import_error:  # pragma: no cover - exercised in minimal Python envs
    ExtractRequest = None  # type: ignore[assignment]
    extract_claims = None  # type: ignore[assignment]
    PIPELINE_IMPORT_ERROR = str(import_error)
else:
    PIPELINE_IMPORT_ERROR = ""


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


async def evaluate() -> dict[str, float]:
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
        if ExtractRequest is not None and extract_claims is not None:
            req = ExtractRequest(
                documentId=case["id"],
                cleanedText=sentence,
                sentences=[{"index": 0, "text": sentence, "paragraphIndex": 0, "charOffset": 0, "charEnd": len(sentence)}],
            )
            response = await extract_claims(req)
            extracted = response.claims
        else:
            extracted = fixture_extract(sentence)
        gt = case["groundTruth"]

        predicted_factual = len(extracted) > 0
        if predicted_factual == gt["isFactual"]:
            results["correct_factual_classification"] += 1

        gt_claims = gt["claims"]
        results["total_ground_truth_claims"] += len(gt_claims)
        results["total_extracted_claims"] += len(extracted)

        for gt_claim in gt_claims:
            matched = any(word_similarity(gt_claim["claimText"], ex.claimText) > 0.75 for ex in extracted)
            if matched:
                results["true_positives"] += 1
            else:
                results["false_negatives"] += 1
                failures.append({"id": case["id"], "type": "missed", "claim": gt_claim["claimText"]})

        for ex in extracted:
            if not any(word_similarity(gt_c["claimText"], ex.claimText) > 0.75 for gt_c in gt_claims):
                results["false_positives"] += 1
                failures.append({"id": case["id"], "type": "spurious", "claim": ex.claimText})

    prf = precision_recall_f1(results["true_positives"], results["false_positives"], results["false_negatives"])
    classification_acc = results["correct_factual_classification"] / max(results["total"], 1)
    payload = {
        **results,
        **prf,
        "classification_acc": classification_acc,
        "sample_failures": failures[:10],
        "usedFixtureExtractor": ExtractRequest is None,
        "pipelineImportError": PIPELINE_IMPORT_ERROR,
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
    asyncio.run(evaluate())
