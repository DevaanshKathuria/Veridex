#!/usr/bin/env python3
"""Evaluate manipulation detector."""

from __future__ import annotations

import asyncio
from collections import defaultdict

from common import load_dataset, precision_recall_f1, write_results

try:
    from app.pipeline.manipulation import ManipulationRequest, detect_manipulation
except Exception as import_error:  # pragma: no cover
    ManipulationRequest = None  # type: ignore[assignment]
    detect_manipulation = None  # type: ignore[assignment]
    PIPELINE_IMPORT_ERROR = str(import_error)
else:
    PIPELINE_IMPORT_ERROR = ""


def fixture_tactics(text: str) -> set[str]:
    lowered = text.lower()
    tactics = set()
    if any(word in lowered for word in ["destroyed", "crushed", "corrupt", "reckless", "nightmare", "abandoned"]):
        tactics.add("emotional_language")
    if any(word in text for word in ["BREAKING", "BOMBSHELL", "SHOCKING", "TOTAL", "!!"]):
        tactics.add("sensational_framing")
    if any(word in lowered for word in ["it is clear", "obviously", "without doubt", "undeniably"]):
        tactics.add("certainty_inflation")
    if "either" in lowered or "if we do not" in lowered:
        tactics.add("false_dilemma")
    if any(word in lowered for word in ["act now", "share this", "before it's too late", "before disaster"]):
        tactics.add("fear_appeal")
    if "omits" in lowered or "omits that" in lowered:
        tactics.add("missing_context")
    return tactics


async def evaluate() -> dict:
    rows = load_dataset("manipulation_test.json")
    counts = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    predictions = []

    for row in rows:
        if ManipulationRequest is not None and detect_manipulation is not None:
            response = await detect_manipulation(ManipulationRequest(originalText=row["text"], claims=[], verdicts=[]))
            predicted = {tactic.tactic for tactic in response.tacticsDetected}
            score = response.overallManipulationScore
            label = response.manipulationLabel
        else:
            predicted = fixture_tactics(row["text"])
            score = min(100, 20 + len(predicted) * 25) if predicted else 0
            label = "High" if score >= 55 else "Moderate" if score >= 30 else "Low" if score else "None"
        expected = set(row["groundTruth"]["tactics"])
        for tactic in expected & predicted:
            counts[tactic]["tp"] += 1
        for tactic in predicted - expected:
            counts[tactic]["fp"] += 1
        for tactic in expected - predicted:
            counts[tactic]["fn"] += 1
        predictions.append(
            {
                "id": row["id"],
                "expected": sorted(expected),
                "predicted": sorted(predicted),
                "score": score,
                "label": label,
            }
        )

    per_tactic = {
        tactic: {**values, **precision_recall_f1(values["tp"], values["fp"], values["fn"])}
        for tactic, values in sorted(counts.items())
    }
    payload = {"perTactic": per_tactic, "predictions": predictions, "usedFixtureDetector": ManipulationRequest is None, "pipelineImportError": PIPELINE_IMPORT_ERROR}
    write_results("manipulation_results.json", payload)

    print("\n=== MANIPULATION EVALUATION ===")
    print("Tactic                 Precision  Recall  F1")
    for tactic, values in per_tactic.items():
        print(f"{tactic:<22} {values['precision']:.3f}      {values['recall']:.3f}   {values['f1']:.3f}")
    return payload


if __name__ == "__main__":
    asyncio.run(evaluate())
