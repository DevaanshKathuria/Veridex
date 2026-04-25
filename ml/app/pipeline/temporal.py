from datetime import datetime, timezone
from typing import Any


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


async def apply_temporal_reasoning(claim: dict[str, Any], verdict: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    time_sensitive_types = ["identity", "statistic", "causal"]
    has_temporal_entity = any(entity.get("label") in ["DATE", "TIME", "PERSON", "ORG"] for entity in claim.get("entities", []))
    is_time_sensitive = claim.get("claimType") in time_sensitive_types or has_temporal_entity

    if not is_time_sensitive:
        return {"temporalVerdict": None, "temporalReasoning": "Claim not considered temporally sensitive."}

    dated_evidence = []
    for item in evidence:
        parsed_date = _parse_date(item.get("publicationDate"))
        if parsed_date:
            dated_evidence.append((parsed_date, item))

    if not dated_evidence:
        return {
            "temporalVerdict": "TEMPORALLY_UNCERTAIN",
            "temporalReasoning": "No publication dates were available on retrieved evidence.",
        }

    dated_evidence.sort(key=lambda item: item[0])
    earliest_date = dated_evidence[0][0]
    latest_date = dated_evidence[-1][0]
    stances = {item[1].get("nliStance") for item in evidence if item.get("nliStance")}

    if (latest_date - earliest_date).days > 365 and len(stances) > 1:
        return {
            "temporalVerdict": "TEMPORALLY_UNCERTAIN",
            "temporalReasoning": "Evidence spans more than a year and supports conflicting temporal interpretations.",
        }

    supporting_dates = [date for date, item in dated_evidence if item.get("nliStance") == "entailment"]
    contradicting_dates = [date for date, item in dated_evidence if item.get("nliStance") == "contradiction"]

    if supporting_dates and contradicting_dates:
        oldest_support = min(supporting_dates)
        newest_contradiction = max(contradicting_dates)
        if (datetime.now(timezone.utc) - oldest_support).days > 730 and newest_contradiction > oldest_support:
            return {
                "temporalVerdict": "OUTDATED",
                "temporalReasoning": "Older supporting evidence is superseded by newer contradictory evidence.",
            }

    if verdict.get("verdict") == "VERIFIED":
        return {
            "temporalVerdict": "VERIFIED_AT_TIME",
            "temporalReasoning": "The claim is supported for the time period represented by the retrieved evidence.",
        }

    return {
        "temporalVerdict": "TEMPORALLY_UNCERTAIN",
        "temporalReasoning": "Temporal context could not be resolved conclusively from the retrieved evidence.",
    }
