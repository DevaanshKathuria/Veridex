import asyncio
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any

import numpy as np
import spacy
from openai import OpenAI
from pydantic import BaseModel

from app.cache import get_embedding_cache, get_norm_cache, set_embedding_cache, set_norm_cache


def _load_extract_nlp() -> Any:
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        fallback = spacy.blank("en")
        if "sentencizer" not in fallback.pipe_names:
            fallback.add_pipe("sentencizer")
        return fallback


nlp = _load_extract_nlp()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
_embedder: Any = None

RELATIVE_TEMPORAL_PATTERN = re.compile(
    r"\b(last quarter|last month|last year|this quarter|this year|recently|yesterday|today|tomorrow|currently|now)\b",
    re.IGNORECASE,
)
YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")
NUMBER_PATTERN = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")


class TemporalContext(BaseModel):
    rawExpression: str | None
    normalizedDate: str | None
    isRelative: bool


class NumericalValue(BaseModel):
    value: float
    unit: str
    rawText: str


class SPO(BaseModel):
    subject: str
    predicate: str
    object: str


class Entity(BaseModel):
    text: str
    label: str
    start: int
    end: int


class SourceSpan(BaseModel):
    sentenceIndex: int
    paragraphIndex: int
    charOffset: int
    charEnd: int


class ClaimDTO(BaseModel):
    claimId: str
    claimText: str
    normalizedClaim: str
    claimType: str
    entities: list[Entity]
    temporalContext: TemporalContext
    numericalValues: list[NumericalValue]
    spo: SPO
    sourceSpan: SourceSpan
    extractionConfidence: float


class ExtractRequest(BaseModel):
    documentId: str
    cleanedText: str
    sentences: list[dict[str, Any]]


class ExtractResponse(BaseModel):
    documentId: str
    claims: list[ClaimDTO]
    totalSentences: int
    factualSentences: int
    extractionLatencyMs: float


@dataclass
class PendingClaim:
    claim_text: str
    claim_type: str
    extraction_confidence: float
    sentence: dict[str, Any]


def _get_embedder() -> Any:
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def _clean_json_payload(payload: str) -> dict[str, Any]:
    stripped = payload.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return json.loads(stripped)


def _heuristic_sentence_label(sentence: str) -> tuple[str, float]:
    normalized = sentence.strip()
    if not normalized:
        return "background", 0.2
    if normalized.endswith("?"):
        return "rhetorical", 0.65
    if normalized.startswith(("\"", "'", "“")):
        return "quote", 0.7
    if re.search(r"\b(I think|maybe|perhaps|should|could|opinion)\b", normalized, re.IGNORECASE):
        return "opinion", 0.7
    if re.search(r"\b(is|are|was|were|has|have|had|will|can|does|did)\b", normalized, re.IGNORECASE):
        return "factual", 0.75
    return "background", 0.5


def _heuristic_claim_type(text: str) -> str:
    lowered = text.lower()
    if re.search(r"\b(percent|%|million|billion|\d)\b", lowered):
        return "statistic"
    if re.search(r"\bcauses?|because|leads to|results in\b", lowered):
        return "causal"
    if re.search(r"\bmore than|less than|higher than|lower than|compared to\b", lowered):
        return "comparative"
    if re.search(r"\bdiscovered|founded|won|elected|signed|in \d{4}\b", lowered):
        return "historical"
    if re.search(r"\bstudy|research|scientists|evidence\b", lowered):
        return "scientific"
    return "identity"


async def _call_openai_json(system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
    if not os.environ.get("OPENAI_API_KEY"):
        return None

    try:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception:
        return None

    content = response.choices[0].message.content if response.choices else None
    if not content:
        return None

    try:
        return _clean_json_payload(content)
    except json.JSONDecodeError:
        return None


async def _classify_sentences(sentences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    factual_sentences: list[dict[str, Any]] = []

    for start in range(0, len(sentences), 10):
        batch = sentences[start : start + 10]
        user_prompt = json.dumps(
            {
                "sentences": [{"index": item["index"], "text": item["text"]} for item in batch],
            }
        )
        payload = await _call_openai_json(
            "Classify each sentence as: factual, opinion, rhetorical, background, or quote. "
            "Return JSON: { classifications: [{ index: int, label: str, confidence: float }] }",
            user_prompt,
        )

        if payload and isinstance(payload.get("classifications"), list):
            by_index = {
                int(entry["index"]): {
                    "label": str(entry.get("label", "background")),
                    "confidence": float(entry.get("confidence", 0)),
                }
                for entry in payload["classifications"]
                if "index" in entry
            }
            for sentence in batch:
                classification = by_index.get(sentence["index"])
                if classification and classification["label"] == "factual":
                    factual_sentences.append(sentence)
            continue

        for sentence in batch:
            label, confidence = _heuristic_sentence_label(sentence["text"])
            if label == "factual":
                factual_sentences.append({**sentence, "classificationConfidence": confidence})

    return factual_sentences


def _context_for_sentence(sentences: list[dict[str, Any]], current_position: int) -> str:
    context_parts: list[str] = []
    if current_position > 0:
        context_parts.append(sentences[current_position - 1]["text"])
    context_parts.append(sentences[current_position]["text"])
    if current_position + 1 < len(sentences):
        context_parts.append(sentences[current_position + 1]["text"])
    return " ".join(context_parts)


async def _extract_claim_batch(
    factual_sentences: list[dict[str, Any]], all_sentences: list[dict[str, Any]]
) -> list[PendingClaim]:
    claims: list[PendingClaim] = []
    sentence_positions = {int(sentence["index"]): position for position, sentence in enumerate(all_sentences)}

    for sentence in factual_sentences:
        sentence_index = int(sentence["index"])
        sentence_position = sentence_positions.get(sentence_index, sentence_index)
        payload = await _call_openai_json(
            "Extract all atomic factual claims from this sentence. "
            "CRITICAL: Decompose compound claims. 'X did A and B' -> two separate claims. "
            "Each claim must be self-contained and verifiable. "
            "Return JSON: { claims: [{ text: str, type: str, confidence: float }] } "
            "Types: statistic, historical, scientific, causal, identity, comparative",
            json.dumps(
                {
                    "sentence": sentence["text"],
                    "context": _context_for_sentence(all_sentences, sentence_position),
                }
            ),
        )

        extracted = payload.get("claims") if payload else None
        if isinstance(extracted, list):
            for item in extracted:
                claim_text = str(item.get("text", "")).strip()
                if not claim_text:
                    continue
                claims.append(
                    PendingClaim(
                        claim_text=claim_text,
                        claim_type=str(item.get("type") or _heuristic_claim_type(claim_text)),
                        extraction_confidence=float(item.get("confidence", 0.75)),
                        sentence=sentence,
                    )
                )
            continue

        claims.append(
            PendingClaim(
                claim_text=sentence["text"].strip(),
                claim_type=_heuristic_claim_type(sentence["text"]),
                extraction_confidence=0.65,
                sentence=sentence,
            )
        )

    return claims


def _extract_temporal_context(doc: Any) -> TemporalContext:
    for ent in getattr(doc, "ents", []):
        if ent.label_ in {"DATE", "TIME"}:
            raw_expression = ent.text
            is_relative = bool(RELATIVE_TEMPORAL_PATTERN.search(raw_expression))
            year_match = YEAR_PATTERN.search(raw_expression)
            normalized = year_match.group(0) if year_match else None
            return TemporalContext(
                rawExpression=raw_expression,
                normalizedDate=normalized,
                isRelative=is_relative,
            )

    relative_match = RELATIVE_TEMPORAL_PATTERN.search(doc.text)
    if relative_match:
        return TemporalContext(
            rawExpression=relative_match.group(0),
            normalizedDate=None,
            isRelative=True,
        )

    return TemporalContext(rawExpression=None, normalizedDate=None, isRelative=False)


def _extract_numerical_values(doc: Any) -> list[NumericalValue]:
    values: list[NumericalValue] = []
    for ent in getattr(doc, "ents", []):
        if ent.label_ not in {"CARDINAL", "PERCENT", "MONEY", "QUANTITY"}:
            continue

        number_match = NUMBER_PATTERN.search(ent.text)
        if not number_match:
            continue

        raw_number = number_match.group(0).replace(",", "")
        unit = ent.text[number_match.end() :].strip()
        if ent.label_ == "PERCENT" and "%" in ent.text and "%" not in unit:
            unit = "%"

        try:
            value = float(raw_number)
        except ValueError:
            continue

        values.append(NumericalValue(value=value, unit=unit, rawText=ent.text))

    return values


def _extract_spo(doc: Any) -> SPO:
    root = next((token for token in doc if token.dep_ == "ROOT"), None)
    subject = next((token.subtree for token in doc if token.dep_ in {"nsubj", "nsubjpass", "csubj"}), None)
    object_token = next((token.subtree for token in doc if token.dep_ in {"dobj", "attr", "pobj", "oprd"}), None)

    if root is not None:
        subject_text = " ".join(token.text for token in subject) if subject else ""
        object_text = " ".join(token.text for token in object_token) if object_token else ""
        if subject_text and object_text:
            return SPO(subject=subject_text, predicate=root.lemma_ or root.text, object=object_text)

    subject_ent = next((ent.text for ent in getattr(doc, "ents", []) if ent.label_ in {"PERSON", "ORG", "GPE"}), None)
    predicate = root.lemma_ if root is not None and getattr(root, "lemma_", "") else (root.text if root is not None else "is")
    object_text = doc.text
    if subject_ent and subject_ent in doc.text:
        object_text = doc.text.replace(subject_ent, "", 1).strip(" ,")

    return SPO(
        subject=subject_ent or (doc[0].text if len(doc) else ""),
        predicate=predicate,
        object=object_text,
    )


async def _normalize_claim(claim_text: str) -> str:
    cached = await get_norm_cache(claim_text)
    if cached:
        return cached

    payload = await _call_openai_json(
        "Normalize this claim: resolve pronouns, normalize tense to present/past, "
        "lowercase entity names. Return JSON: { normalized: str }",
        json.dumps({"claim": claim_text}),
    )
    normalized = str(payload.get("normalized")).strip() if payload and payload.get("normalized") else claim_text.lower().strip()
    await set_norm_cache(claim_text, normalized)
    return normalized


async def _embedding_for_text(text: str) -> list[float]:
    cached = await get_embedding_cache(text)
    if cached:
        return cached

    embedder = _get_embedder()
    vector = await asyncio.to_thread(embedder.encode, text, convert_to_numpy=True)
    vector_list = vector.tolist()
    await set_embedding_cache(text, vector_list)
    return vector_list


def _deduplicate_claims(claims: list[ClaimDTO], embeddings: list[list[float]]) -> list[ClaimDTO]:
    if len(claims) <= 1:
        return claims

    matrix = np.array(embeddings, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    normalized = matrix / np.clip(norms, a_min=1e-12, a_max=None)
    similarity_matrix = normalized @ normalized.T

    removed: set[int] = set()
    for i in range(len(claims)):
        if i in removed:
            continue
        for j in range(i + 1, len(claims)):
            if j in removed:
                continue
            if similarity_matrix[i, j] > 0.92:
                keep_index = i if len(claims[i].claimText) >= len(claims[j].claimText) else j
                drop_index = j if keep_index == i else i
                removed.add(drop_index)

    return [claim for index, claim in enumerate(claims) if index not in removed]


async def extract_claims(req: ExtractRequest) -> ExtractResponse:
    start = time.perf_counter()
    sentences = req.sentences
    factual_sentences = await _classify_sentences(sentences)
    pending_claims = await _extract_claim_batch(factual_sentences, sentences)

    claim_dtos: list[ClaimDTO] = []
    for pending in pending_claims:
        claim_doc = nlp(pending.claim_text)
        normalized_claim = await _normalize_claim(pending.claim_text)
        entities = [
            Entity(text=ent.text, label=ent.label_, start=ent.start_char, end=ent.end_char)
            for ent in getattr(claim_doc, "ents", [])
        ]
        temporal_context = _extract_temporal_context(claim_doc)
        numerical_values = _extract_numerical_values(claim_doc)
        spo = _extract_spo(claim_doc)
        source_span = SourceSpan(
            sentenceIndex=int(pending.sentence["index"]),
            paragraphIndex=int(pending.sentence["paragraphIndex"]),
            charOffset=int(pending.sentence["charOffset"]),
            charEnd=int(pending.sentence["charEnd"]),
        )

        claim_dtos.append(
            ClaimDTO(
                claimId=str(uuid.uuid4()),
                claimText=pending.claim_text,
                normalizedClaim=normalized_claim,
                claimType=pending.claim_type,
                entities=entities,
                temporalContext=temporal_context,
                numericalValues=numerical_values,
                spo=spo,
                sourceSpan=source_span,
                extractionConfidence=pending.extraction_confidence,
            )
        )

    embeddings = [await _embedding_for_text(claim.normalizedClaim) for claim in claim_dtos]
    deduplicated_claims = _deduplicate_claims(claim_dtos, embeddings)

    return ExtractResponse(
        documentId=req.documentId,
        claims=deduplicated_claims,
        totalSentences=len(sentences),
        factualSentences=len(factual_sentences),
        extractionLatencyMs=(time.perf_counter() - start) * 1000,
    )
