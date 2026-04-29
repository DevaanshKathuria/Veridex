#!/usr/bin/env python3
"""Evaluate manipulation detector."""

from __future__ import annotations

import asyncio
import argparse
from collections import defaultdict

from common import DATASET_DIR, load_dataset, post_json, precision_recall_f1, print_eval_header, write_results


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


async def live_detect(text: str, ml_url: str) -> tuple[set[str], int, str]:
    response = await asyncio.to_thread(
        post_json,
        f"{ml_url.rstrip('/')}/process/manipulate",
        {"originalText": text, "claims": [], "verdicts": []},
        120,
    )
    tactics = {item.get("tactic", "") for item in response.get("tacticsDetected", []) if item.get("tactic")}
    return tactics, int(response.get("overallManipulationScore", 0)), str(response.get("manipulationLabel", "None"))


async def evaluate(live: bool = False, ml_url: str = "http://localhost:8000") -> dict:
    print_eval_header("Manipulation", str(DATASET_DIR / "manipulation_test.json"), live)
    rows = load_dataset("manipulation_test.json")
    counts = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    predictions = []

    for row in rows:
        if live:
            predicted, score, label = await live_detect(row["text"], ml_url)
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
    payload = {"mode": "live" if live else "fixture", "mlServiceUrl": ml_url if live else None, "perTactic": per_tactic, "predictions": predictions}
    write_results("manipulation_results.json", payload)

    print("\n=== MANIPULATION EVALUATION ===")
    print("Tactic                 Precision  Recall  F1")
    for tactic, values in per_tactic.items():
        print(f"{tactic:<22} {values['precision']:.3f}      {values['recall']:.3f}   {values['f1']:.3f}")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate manipulation detection.")
    parser.add_argument("--live", action="store_true", help="Call real ML service at ML_SERVICE_URL.")
    parser.add_argument("--fixture", action="store_true", default=True, help="Use deterministic fixture data (default).")
    parser.add_argument("--ml-url", default="http://localhost:8000", help="ML service URL for --live mode.")
    args = parser.parse_args()
    asyncio.run(evaluate(live=args.live, ml_url=args.ml_url))
