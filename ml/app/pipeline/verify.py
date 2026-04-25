import asyncio
import json
import os
import re
import time
from typing import Any

from openai import OpenAI
from pydantic import BaseModel, Field

from app.pipeline.numerical import compare_numerical_claims, extract_numerical_values
from app.pipeline.temporal import apply_temporal_reasoning


client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
TIER_WEIGHTS = {1: 1.0, 2: 0.8, 3: 0.6, 4: 0.3}


class VerdictDTO(BaseModel):
    claimId: str
    verdict: str
    confidence: int
    reasoning: str
    supportingChunkIds: list[str]
    contradictingChunkIds: list[str]
    evidenceSufficiency: str
    stanceBreakdown: dict[str, float]
    calibrationOverrideApplied: bool = False
    supportScore: float
    contradictionScore: float
    sufficiencyScore: float
    temporalVerdict: str | None = None
    temporalReasoning: str | None = None
    numericalConsistencyScore: float | None = None


class VerifyRequest(BaseModel):
    claims: list[dict[str, Any]]
    evidenceMap: dict[str, list[dict[str, Any]]]


class VerifyResponse(BaseModel):
    verdicts: list[VerdictDTO]
    latencyMs: float


def _parse_json_response(content: str | None) -> dict[str, Any]:
    if not content:
        return {}

    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    return json.loads(stripped or "{}")


def _chunk_reference_to_chunk_id(reference: str, evidence: list[dict[str, Any]]) -> str | None:
    reference = reference.strip()
    direct_match = next((chunk["chunkId"] for chunk in evidence if chunk["chunkId"] == reference), None)
    if direct_match:
        return direct_match

    match = re.search(r"CHUNK\s+(\d+)", reference, re.IGNORECASE)
    if not match:
        return None

    index = int(match.group(1)) - 1
    if 0 <= index < len(evidence):
        return evidence[index]["chunkId"]
    return None


async def _call_gpt_verifier(claim_text: str, evidence: list[dict[str, Any]]) -> dict[str, Any]:
    evidence_context = "\n\n".join(
        [
            f"[CHUNK {index + 1}] Source: {chunk['source']} (Tier {chunk['reliabilityTier']}, {chunk.get('publicationDate', 'unknown date')})\n{chunk['chunkText']}"
            for index, chunk in enumerate(evidence[:6])
        ]
    )

    if not os.environ.get("OPENAI_API_KEY"):
        if not evidence:
            return {
                "verdict": "UNSUPPORTED",
                "confidence": 20,
                "reasoning": "No evidence was retrieved for this claim.",
                "supportingChunkIds": [],
                "contradictingChunkIds": [],
                "evidenceSufficiency": "low",
            }

        entailments = [chunk for chunk in evidence if chunk.get("nliStance") == "entailment"]
        contradictions = [chunk for chunk in evidence if chunk.get("nliStance") == "contradiction"]
        if entailments and contradictions:
            verdict = "DISPUTED"
        elif contradictions:
            verdict = "FALSE"
        elif entailments:
            verdict = "VERIFIED"
        else:
            verdict = "INSUFFICIENT_EVIDENCE"
        return {
            "verdict": verdict,
            "confidence": 65,
            "reasoning": "Fallback verdict derived from NLI stance distribution because GPT verification was unavailable.",
            "supportingChunkIds": [chunk["chunkId"] for chunk in entailments[:3]],
            "contradictingChunkIds": [chunk["chunkId"] for chunk in contradictions[:3]],
            "evidenceSufficiency": "medium" if len(evidence) >= 3 else "low",
        }

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": """You are a rigorous fact-checker with access to provided evidence only.
Rules:
- Base your verdict ONLY on the provided evidence chunks. Never fabricate sources.
- VERIFIED: evidence clearly supports the claim
- DISPUTED: evidence partially supports and partially contradicts
- FALSE: evidence clearly contradicts the claim
- UNSUPPORTED: no relevant evidence found (evidence exists but is irrelevant)
- INSUFFICIENT_EVIDENCE: too little evidence to make a determination
- Distinguish FALSE from UNSUPPORTED carefully.
Return JSON: { verdict, confidence (0-100), reasoning (2-3 sentences citing specific chunks by number),
supportingChunkIds (list of "CHUNK N" strings), contradictingChunkIds, evidenceSufficiency ("high"|"medium"|"low") }""",
            },
            {
                "role": "user",
                "content": f"CLAIM: {claim_text}\n\nEVIDENCE:\n{evidence_context}",
            },
        ],
        max_tokens=500,
    )
    content = response.choices[0].message.content if response.choices else "{}"
    return _parse_json_response(content)


async def verify_claims(req: VerifyRequest) -> VerifyResponse:
    async def verify_one(claim: dict[str, Any], semaphore: asyncio.Semaphore) -> VerdictDTO:
        async with semaphore:
            claim_id = claim["claimId"]
            claim_text = claim.get("normalizedClaim") or claim.get("claimText") or ""
            evidence = req.evidenceMap.get(claim_id, [])

            supporting = [chunk for chunk in evidence if chunk.get("nliStance") == "entailment"]
            contradicting = [chunk for chunk in evidence if chunk.get("nliStance") == "contradiction"]

            support_score = sum(
                float(chunk.get("nliConfidence", 0.0)) * TIER_WEIGHTS.get(int(chunk.get("reliabilityTier", 4)), 0.3)
                for chunk in supporting
            ) / max(len(supporting), 1)
            contradiction_score = sum(
                float(chunk.get("nliConfidence", 0.0)) * TIER_WEIGHTS.get(int(chunk.get("reliabilityTier", 4)), 0.3)
                for chunk in contradicting
            ) / max(len(contradicting), 1)
            sufficiency_score = min(len([chunk for chunk in evidence if chunk.get("nliStance") != "neutral"]) / 3, 1.0)

            neutral_score = max(0.0, 1 - support_score - contradiction_score)
            stance_breakdown = {
                "entailment": support_score,
                "contradiction": contradiction_score,
                "neutral": neutral_score,
            }

            result = await _call_gpt_verifier(claim_text, evidence)
            verdict = str(result.get("verdict", "INSUFFICIENT_EVIDENCE"))
            calibration_override = False

            if verdict == "VERIFIED" and contradiction_score > 0.6:
                verdict = "DISPUTED"
                calibration_override = True
            elif verdict == "FALSE" and support_score > 0.7:
                verdict = "DISPUTED"
                calibration_override = True
            elif sufficiency_score < 0.3:
                verdict = "INSUFFICIENT_EVIDENCE"
                calibration_override = True

            supporting_ids = []
            for chunk_ref in result.get("supportingChunkIds", []):
                chunk_id = _chunk_reference_to_chunk_id(str(chunk_ref), evidence)
                if chunk_id:
                    supporting_ids.append(chunk_id)

            contradicting_ids = []
            for chunk_ref in result.get("contradictingChunkIds", []):
                chunk_id = _chunk_reference_to_chunk_id(str(chunk_ref), evidence)
                if chunk_id:
                    contradicting_ids.append(chunk_id)

            temporal_result = await apply_temporal_reasoning(claim, {"verdict": verdict}, evidence)
            claim_numerical_values = claim.get("numericalValues") or extract_numerical_values(str(claim.get("claimText", "")))
            evidence_numerical_values = []
            for chunk in evidence:
                evidence_numerical_values.extend(extract_numerical_values(chunk.get("chunkText", "")))
            numerical_result = compare_numerical_claims(claim_numerical_values, evidence_numerical_values)

            return VerdictDTO(
                claimId=claim_id,
                verdict=verdict,
                confidence=int(result.get("confidence", 0)),
                reasoning=str(result.get("reasoning", "")),
                supportingChunkIds=list(dict.fromkeys(supporting_ids)),
                contradictingChunkIds=list(dict.fromkeys(contradicting_ids)),
                evidenceSufficiency=str(result.get("evidenceSufficiency", "low")),
                stanceBreakdown=stance_breakdown,
                calibrationOverrideApplied=calibration_override,
                supportScore=support_score,
                contradictionScore=contradiction_score,
                sufficiencyScore=sufficiency_score,
                temporalVerdict=temporal_result.get("temporalVerdict"),
                temporalReasoning=temporal_result.get("temporalReasoning"),
                numericalConsistencyScore=(
                    float(numerical_result["numericalConsistencyScore"])
                    if numerical_result.get("hasNumericalClaim")
                    else None
                ),
            )

    semaphore = asyncio.Semaphore(3)
    start = time.time()
    verdicts = await asyncio.gather(*[verify_one(claim, semaphore) for claim in req.claims])
    return VerifyResponse(
        verdicts=list(verdicts),
        latencyMs=(time.time() - start) * 1000,
    )
