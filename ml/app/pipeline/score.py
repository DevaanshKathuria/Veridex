import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from openai import OpenAI
from pydantic import BaseModel


WEIGHTS_PATH = Path(__file__).resolve().parent.parent / "config" / "scoring_weights.json"
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
weights: dict[str, float] = {}


class ScoreRequest(BaseModel):
    claims: list[dict[str, Any]]
    verdicts: list[dict[str, Any]]
    manipulationResult: dict[str, Any]


class ScoreResponse(BaseModel):
    credibilityScore: int
    confidenceBand: int
    credibilityLabel: str
    scoreBreakdown: dict[str, float]
    summary: str
    latencyMs: float


DEFAULT_WEIGHTS = {
    "verifiedWeight": 50,
    "disputedPenalty": 15,
    "falsePenalty": 20,
    "unsupportedPenalty": 10,
    "retrievalSufficiencyWeight": 5,
    "manipulationPenaltyMultiplier": 15,
    "qualityMultiplierBase": 0.7,
    "qualityMultiplierRange": 0.3,
}


def load_weights() -> dict[str, float]:
    if not WEIGHTS_PATH.exists():
        return dict(DEFAULT_WEIGHTS)
    with WEIGHTS_PATH.open() as file:
        loaded = json.load(file)
    return {**DEFAULT_WEIGHTS, **loaded}


def reload_weights() -> dict[str, float]:
    global weights
    weights = load_weights()
    return weights


reload_weights()


def write_weights(updated_weights: dict[str, Any]) -> dict[str, float]:
    merged = {**DEFAULT_WEIGHTS, **{key: float(value) for key, value in updated_weights.items() if key in DEFAULT_WEIGHTS}}
    with WEIGHTS_PATH.open("w") as file:
        json.dump(merged, file, indent=2)
        file.write("\n")
    return reload_weights()


def _verdict_value(verdict: dict[str, Any], key: str, default: Any = None) -> Any:
    return verdict.get(key, default)


async def _build_summary(final_score: int, label: str, verified: float, false_: float, manipulation_label: str) -> str:
    fallback = (
        f"The analysis received a {label.lower()} credibility score of {final_score}/100. "
        f"{int(verified * 100)}% of analyzed claims were verified, {int(false_ * 100)}% were false, and manipulation was rated {manipulation_label}."
    )
    if not os.environ.get("OPENAI_API_KEY"):
        return fallback

    try:
        summary_response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "Write a 2-sentence credibility summary for a fact-check report. Be precise and neutral.",
                },
                {
                    "role": "user",
                    "content": f"Score: {final_score}/100 ({label}). Verified: {int(verified * 100)}%, False: {int(false_ * 100)}%, Manipulation: {manipulation_label}. Summarize.",
                },
            ],
            max_tokens=100,
        )
        content = summary_response.choices[0].message.content if summary_response.choices else ""
        return content.strip() or fallback
    except Exception:
        return fallback


async def calculate_score(req: ScoreRequest) -> ScoreResponse:
    start = time.time()
    w = reload_weights()

    total = len(req.verdicts)
    if total == 0:
        return ScoreResponse(
            credibilityScore=0,
            confidenceBand=15,
            credibilityLabel="Very Low",
            scoreBreakdown={},
            summary="No claims could be analyzed.",
            latencyMs=(time.time() - start) * 1000,
        )

    verified = sum(1 for v in req.verdicts if _verdict_value(v, "verdict") == "VERIFIED") / total
    disputed = sum(1 for v in req.verdicts if _verdict_value(v, "verdict") == "DISPUTED") / total
    false_ = sum(1 for v in req.verdicts if _verdict_value(v, "verdict") == "FALSE") / total
    unsupported = sum(1 for v in req.verdicts if _verdict_value(v, "verdict") == "UNSUPPORTED") / total
    insufficient = sum(1 for v in req.verdicts if _verdict_value(v, "verdict") == "INSUFFICIENT_EVIDENCE") / total

    avg_confidence = sum(float(_verdict_value(v, "confidence", 0)) for v in req.verdicts) / total

    all_tiers: list[float] = []
    for claim in req.claims:
        for evidence in claim.get("supportingEvidence", []) + claim.get("contradictingEvidence", []):
            all_tiers.append(float(evidence.get("reliabilityTier", 4)))
    avg_evidence_quality = (sum(all_tiers) / len(all_tiers) / 4) if all_tiers else 0.5
    avg_evidence_quality = min(max(avg_evidence_quality, 0), 1)

    retrieval_sufficiency = sum(float(v.get("sufficiencyScore", 0.5)) for v in req.verdicts) / total
    manipulation_penalty = float(req.manipulationResult.get("overallManipulationScore", 0)) / 100

    base_score = (
        verified * w["verifiedWeight"]
        + (1 - disputed) * w["disputedPenalty"]
        + (1 - false_) * w["falsePenalty"]
        + (1 - unsupported) * w["unsupportedPenalty"]
        + retrieval_sufficiency * w["retrievalSufficiencyWeight"]
    )
    quality_multiplier = w["qualityMultiplierBase"] + w["qualityMultiplierRange"] * avg_evidence_quality
    confidence_adjustment = (avg_confidence - 50) / 100 * 5
    final_score = base_score * quality_multiplier + confidence_adjustment - (
        manipulation_penalty * w["manipulationPenaltyMultiplier"]
    )
    final_score = max(0, min(100, int(final_score)))

    confidence_band = int((1 - retrieval_sufficiency) * 15)
    label = "High" if final_score >= 70 else "Moderate" if final_score >= 40 else "Low" if final_score >= 20 else "Very Low"

    score_breakdown = {
        "verifiedRatioContribution": round(verified * w["verifiedWeight"], 2),
        "evidenceQualityContribution": round((quality_multiplier - w["qualityMultiplierBase"]) * base_score, 2),
        "manipulationPenaltyApplied": round(manipulation_penalty * w["manipulationPenaltyMultiplier"], 2),
        "retrievalSufficiencyFactor": round(retrieval_sufficiency * w["retrievalSufficiencyWeight"], 2),
        "disputedRatio": round(disputed, 3),
        "falseRatio": round(false_, 3),
        "unsupportedRatio": round(unsupported, 3),
        "insufficientRatio": round(insufficient, 3),
    }

    summary = await _build_summary(
        final_score,
        label,
        verified,
        false_,
        str(req.manipulationResult.get("manipulationLabel", "None")),
    )

    return ScoreResponse(
        credibilityScore=final_score,
        confidenceBand=confidence_band,
        credibilityLabel=label,
        scoreBreakdown=score_breakdown,
        summary=summary,
        latencyMs=(time.time() - start) * 1000,
    )
