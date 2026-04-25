import re
from typing import Any


PERCENT_PATTERN = re.compile(r"(\d+\.?\d*)\s*%")
CURRENCY_PATTERN = re.compile(r"\$(\d+\.?\d*)\s*(billion|million|thousand)?", re.IGNORECASE)
COUNT_PATTERN = re.compile(r"(\d+\.?\d*)\s*(million|billion|thousand)\s+(people|units|jobs)", re.IGNORECASE)
PLAIN_NUMBER_PATTERN = re.compile(r"\b(\d+\.?\d*)\b")

SCALE_MAP = {
    "thousand": 1_000,
    "million": 1_000_000,
    "billion": 1_000_000_000,
}


def _extract_context(text: str, start: int, end: int) -> str:
    window_start = max(0, start - 20)
    window_end = min(len(text), end + 20)
    return text[window_start:window_end].lower()


def _normalize_scaled_value(value: float, scale: str | None) -> float:
    if not scale:
        return value
    return value * SCALE_MAP.get(scale.lower(), 1)


def extract_numerical_values(text: str) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []

    for match in PERCENT_PATTERN.finditer(text):
        values.append(
            {
                "value": float(match.group(1)),
                "unit": "%",
                "rawText": match.group(0),
                "context": _extract_context(text, match.start(), match.end()),
            }
        )

    for match in CURRENCY_PATTERN.finditer(text):
        base_value = _normalize_scaled_value(float(match.group(1)), match.group(2))
        values.append(
            {
                "value": base_value,
                "unit": "USD",
                "rawText": match.group(0),
                "context": _extract_context(text, match.start(), match.end()),
            }
        )

    for match in COUNT_PATTERN.finditer(text):
        base_value = _normalize_scaled_value(float(match.group(1)), match.group(2))
        values.append(
            {
                "value": base_value,
                "unit": match.group(3).lower(),
                "rawText": match.group(0),
                "context": _extract_context(text, match.start(), match.end()),
            }
        )

    for match in PLAIN_NUMBER_PATTERN.finditer(text):
        raw_text = match.group(0)
        if any(raw_text in existing["rawText"] for existing in values):
            continue
        values.append(
            {
                "value": float(raw_text),
                "unit": "",
                "rawText": raw_text,
                "context": _extract_context(text, match.start(), match.end()),
            }
        )

    return values


def compare_numerical_claims(claim_values: list[dict[str, Any]], evidence_values: list[dict[str, Any]]) -> dict[str, Any]:
    if not claim_values:
        return {
            "hasNumericalClaim": False,
            "numericalConsistencyScore": 0.0,
            "numericalMatches": [],
        }

    matches: list[dict[str, Any]] = []
    scores: list[float] = []

    for claim_value in claim_values:
        best_match: dict[str, Any] | None = None
        best_score = 0.0
        claim_number = float(claim_value["value"])

        for evidence_value in evidence_values:
            evidence_number = float(evidence_value["value"])
            exact_match = abs(claim_number - evidence_number) < 1e-6
            fuzzy_match = abs(claim_number - evidence_number) / max(abs(evidence_number), 1e-6) < 0.05
            claim_context = str(claim_value.get("context", ""))
            evidence_context = str(evidence_value.get("context", ""))
            directional_match = (
                ("increased" in claim_context and "increased" in evidence_context)
                or ("decreased" in claim_context and "decreased" in evidence_context)
            )
            unit_ambiguity = claim_value.get("unit") != evidence_value.get("unit") and abs(claim_number - evidence_number) < max(abs(evidence_number), 1e-6) * 0.05

            if exact_match:
                score = 1.0
                match_type = "exact"
            elif fuzzy_match:
                score = 0.8
                match_type = "fuzzy"
            elif directional_match:
                score = 0.5
                match_type = "directional"
            elif unit_ambiguity:
                score = 0.2
                match_type = "unit_ambiguity"
            else:
                score = 0.0
                match_type = "none"

            if score > best_score:
                best_score = score
                best_match = {
                    "claimValue": claim_value,
                    "evidenceValue": evidence_value,
                    "matchType": match_type,
                    "withinTolerance": match_type in {"exact", "fuzzy"},
                }

        matches.append(
            best_match
            or {
                "claimValue": claim_value,
                "evidenceValue": None,
                "matchType": "none",
                "withinTolerance": False,
            }
        )
        scores.append(best_score)

    consistency_score = sum(scores) / len(scores) if scores else 0.0
    return {
        "hasNumericalClaim": True,
        "numericalConsistencyScore": consistency_score,
        "numericalMatches": matches,
    }
