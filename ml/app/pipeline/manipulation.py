import asyncio
import json
import os
import re
import time
from typing import Any

import spacy
from openai import OpenAI
from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


analyzer = SentimentIntensityAnalyzer()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


def _load_nlp() -> Any:
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        fallback = spacy.blank("en")
        if "sentencizer" not in fallback.pipe_names:
            fallback.add_pipe("sentencizer")
        return fallback


nlp = _load_nlp()


class ManipulationTactic(BaseModel):
    tactic: str
    excerpt: str
    charOffset: int
    charEnd: int
    intensityScore: float
    explanation: str


class ManipulationRequest(BaseModel):
    originalText: str
    claims: list[dict[str, Any]]
    verdicts: list[dict[str, Any]]


class ManipulationResponse(BaseModel):
    tacticsDetected: list[ManipulationTactic]
    overallManipulationScore: int
    manipulationLabel: str
    latencyMs: float


FACTUAL_PATTERN = re.compile(
    r"\b(is|are|was|were|has|have|had|will|does|did|causes?|shows?|proves?|found|reported|increased|decreased|\d)\b",
    re.IGNORECASE,
)
QUOTE_PREFIX_PATTERN = re.compile(r"^\s*[\"'“”]")
CITATION_PATTERN = re.compile(
    r"(https?://|\bdoi:|\baccording to [A-Z][A-Za-z .-]+|\b[A-Z][A-Za-z .-]+ (reported|found|said|published)|\[[0-9]+\]|\([A-Za-z]+,? \d{4}\))",
    re.IGNORECASE,
)


def _sentences_with_offsets(text: str) -> list[tuple[str, int, int]]:
    doc = nlp(text)
    spans: list[tuple[str, int, int]] = []
    for sentence in doc.sents:
        sentence_text = sentence.text.strip()
        if not sentence_text:
            continue
        offset = text.find(sentence_text, sentence.start_char)
        if offset < 0:
            offset = text.find(sentence_text)
        if offset >= 0:
            spans.append((sentence_text, offset, offset + len(sentence_text)))
    if spans:
        return spans

    return [
        (match.group(0).strip(), match.start(), match.end())
        for match in re.finditer(r"[^.!?]+[.!?]?", text)
        if match.group(0).strip()
    ]


def _is_factual(sentence: str) -> bool:
    return bool(FACTUAL_PATTERN.search(sentence))


def _is_quote(sentence: str) -> bool:
    return bool(QUOTE_PREFIX_PATTERN.search(sentence))


def _tactic(tactic: str, excerpt: str, start: int, end: int, intensity: float, explanation: str) -> ManipulationTactic:
    return ManipulationTactic(
        tactic=tactic,
        excerpt=excerpt.strip(),
        charOffset=max(start, 0),
        charEnd=max(end, start),
        intensityScore=max(0.0, min(float(intensity), 1.0)),
        explanation=explanation,
    )


def _sentence_for_offset(sentences: list[tuple[str, int, int]], offset: int) -> tuple[str, int, int] | None:
    for sentence in sentences:
        if sentence[1] <= offset <= sentence[2]:
            return sentence
    return None


def _near_uncertain_verdict(sentence_start: int, sentence_end: int, verdicts: list[dict[str, Any]]) -> bool:
    uncertain = {"DISPUTED", "FALSE", "UNSUPPORTED", "INSUFFICIENT_EVIDENCE"}
    for verdict in verdicts:
        if str(verdict.get("verdict")) in uncertain:
            span = verdict.get("sourceSpan") or {}
            claim_start = int(span.get("charOffset", -10_000))
            claim_end = int(span.get("charEnd", -10_000))
            if abs(claim_start - sentence_start) < 240 or (sentence_start <= claim_end and claim_start <= sentence_end):
                return True
    return False


def detect_emotional_language(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    for sentence, start, end in _sentences_with_offsets(text):
        scores = analyzer.polarity_scores(sentence)
        compound = float(scores.get("compound", 0.0))
        if abs(compound) > 0.8 and _is_factual(sentence):
            tactics.append(
                _tactic(
                    "emotional_language",
                    sentence,
                    start,
                    end,
                    abs(compound),
                    "Strong sentiment is attached to a factual-sounding statement.",
                )
            )
    return tactics


def detect_sensational_framing(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    patterns = [
        (r"\b(BREAKING|SHOCKING|BOMBSHELL)\b", re.IGNORECASE, 0.72, "Sensational framing keyword."),
        (r"\b[A-Z]{4,}\b", 0, 0.58, "All-caps emphasis can amplify a factual claim."),
        (r"!{2,}", 0, 0.62, "Excessive exclamation marks create heightened urgency."),
        (r"\b(most|best|worst|biggest|deadliest)\b", re.IGNORECASE, 0.55, "Superlative framing should be supported by precise evidence."),
    ]
    sentences = _sentences_with_offsets(text)
    for pattern, flags, intensity, explanation in patterns:
        for match in re.finditer(pattern, text, flags):
            sentence = _sentence_for_offset(sentences, match.start())
            if sentence and not _is_factual(sentence[0]):
                continue
            excerpt = sentence[0] if sentence else match.group(0)
            start = sentence[1] if sentence else match.start()
            end = sentence[2] if sentence else match.end()
            tactics.append(_tactic("sensational_framing", excerpt, start, end, intensity, explanation))
    return tactics


def detect_overgeneralization(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    sentences = _sentences_with_offsets(text)
    for match in re.finditer(r"\b(always|never|everyone|nobody|all \w+|no \w+)\b", text, re.IGNORECASE):
        sentence = _sentence_for_offset(sentences, match.start())
        if not sentence or _is_quote(sentence[0]) or not _is_factual(sentence[0]):
            continue
        tactics.append(
            _tactic(
                "overgeneralization",
                sentence[0],
                sentence[1],
                sentence[2],
                0.68,
                "Absolute language is used around a factual claim.",
            )
        )
    return tactics


def detect_false_dilemma(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    catastrophic = r"(collapse|destroy|disaster|catastrophe|chaos|ruin|death|war|against us)"
    patterns = [
        rf"\beither\b.{0,120}\bor\b.{0,80}\b{catastrophic}\b",
        r"\byou(?:'re| are) either with us or against us\b",
        rf"\bif we don'?t\b.{0,120}\bthen\b.{0,100}\b{catastrophic}\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
            excerpt = re.sub(r"\s+", " ", match.group(0)).strip()
            tactics.append(
                _tactic(
                    "false_dilemma",
                    excerpt,
                    match.start(),
                    match.end(),
                    0.78,
                    "The text frames complex choices as a narrow or catastrophic binary.",
                )
            )
    return tactics


def detect_cherry_picking(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    patterns = [
        r"\bsome experts say\b",
        r"\bmany studies show\b",
        r"\baccording to reports\b",
        r"\bsources indicate\b",
    ]
    sentences = _sentences_with_offsets(text)
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            sentence = _sentence_for_offset(sentences, match.start())
            excerpt = sentence[0] if sentence else match.group(0)
            start = sentence[1] if sentence else match.start()
            end = sentence[2] if sentence else match.end()
            tactics.append(
                _tactic(
                    "cherry_picking",
                    excerpt,
                    start,
                    end,
                    0.66,
                    "A broad sourcing phrase is used without enough specific attribution.",
                )
            )
    return tactics


def detect_certainty_inflation(text: str, verdicts: list[dict[str, Any]]) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    sentences = _sentences_with_offsets(text)
    pattern = r"\b(definitely|it is clear that|undeniably|obviously|without doubt|certainly)\b"
    for match in re.finditer(pattern, text, re.IGNORECASE):
        sentence = _sentence_for_offset(sentences, match.start())
        if not sentence:
            continue
        intensity = 0.86 if _near_uncertain_verdict(sentence[1], sentence[2], verdicts) else 0.62
        tactics.append(
            _tactic(
                "certainty_inflation",
                sentence[0],
                sentence[1],
                sentence[2],
                intensity,
                "High-certainty wording is used where the evidence may not warrant it.",
            )
        )
    return tactics


def detect_ad_hominem(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    negative = re.compile(r"\b(corrupt|lying|criminal|fraud|dishonest|traitor|crook)\b", re.IGNORECASE)
    for sentence, start, end in _sentences_with_offsets(text):
        if not negative.search(sentence):
            continue
        doc = nlp(sentence)
        if any(entity.label_ == "PERSON" for entity in doc.ents):
            tactics.append(
                _tactic(
                    "ad_hominem",
                    sentence,
                    start,
                    end,
                    0.74,
                    "A negative personal descriptor is attached to a named person.",
                )
            )
    return tactics


def detect_misleading_authority(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    authority_pattern = re.compile(r"\b(studies show|scientists say|experts agree|research proves)\b", re.IGNORECASE)
    sentences = _sentences_with_offsets(text)
    for index, (sentence, start, end) in enumerate(sentences):
        if not authority_pattern.search(sentence):
            continue
        context = " ".join(item[0] for item in sentences[max(0, index - 1) : min(len(sentences), index + 2)])
        if CITATION_PATTERN.search(context):
            continue
        tactics.append(
            _tactic(
                "misleading_authority",
                sentence,
                start,
                end,
                0.7,
                "Authority is invoked without a specific citation nearby.",
            )
        )
    return tactics


def detect_fear_appeal(text: str) -> list[ManipulationTactic]:
    tactics: list[ManipulationTactic] = []
    urgency = re.compile(r"\b(immediately|right now|now|before it'?s too late|act now|must act|share this)\b", re.IGNORECASE)
    action = re.compile(r"\b(call|click|share|donate|vote|buy|act|stop|demand)\b", re.IGNORECASE)
    for sentence, start, end in _sentences_with_offsets(text):
        compound = float(analyzer.polarity_scores(sentence).get("compound", 0.0))
        if compound < -0.65 and urgency.search(sentence) and action.search(sentence):
            tactics.append(
                _tactic(
                    "fear_appeal",
                    sentence,
                    start,
                    end,
                    min(abs(compound) + 0.1, 1.0),
                    "Fear-oriented language is paired with urgency and a call to action.",
                )
            )
    return tactics


async def detect_missing_context(text: str, claims: list[dict[str, Any]]) -> ManipulationTactic | None:
    if not os.environ.get("OPENAI_API_KEY"):
        return None

    try:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a media critic. Identify if this text omits critical context."},
                {
                    "role": "user",
                    "content": f"TEXT: {text[:3000]}\n\nCLAIMS: {json.dumps(claims[:10])}\n\nReturn JSON: {{ missingContextDetected: bool, explanation: str, excerpt: str }}",
                },
            ],
            max_tokens=200,
        )
        content = response.choices[0].message.content if response.choices else "{}"
        result = json.loads(content or "{}")
    except Exception:
        return None

    if result.get("missingContextDetected"):
        excerpt = str(result.get("excerpt") or text[:100])
        offset = text.find(excerpt)
        start = max(offset, 0)
        return _tactic(
            "missing_context",
            excerpt,
            start,
            start + len(excerpt),
            0.7,
            str(result.get("explanation") or "The text may omit important context."),
        )
    return None


async def detect_manipulation(req: ManipulationRequest) -> ManipulationResponse:
    start = time.time()
    all_tactics: list[ManipulationTactic] = []

    all_tactics.extend(detect_emotional_language(req.originalText))
    all_tactics.extend(detect_sensational_framing(req.originalText))
    all_tactics.extend(detect_overgeneralization(req.originalText))
    all_tactics.extend(detect_false_dilemma(req.originalText))
    all_tactics.extend(detect_cherry_picking(req.originalText))
    all_tactics.extend(detect_certainty_inflation(req.originalText, req.verdicts))
    all_tactics.extend(detect_ad_hominem(req.originalText))
    all_tactics.extend(detect_misleading_authority(req.originalText))
    all_tactics.extend(detect_fear_appeal(req.originalText))

    missing_ctx = await detect_missing_context(req.originalText, req.claims)
    if missing_ctx:
        all_tactics.append(missing_ctx)

    deduped: list[ManipulationTactic] = []
    for tactic in sorted(all_tactics, key=lambda item: item.intensityScore, reverse=True):
        overlaps = any(abs(tactic.charOffset - existing.charOffset) < 50 and tactic.tactic == existing.tactic for existing in deduped)
        if not overlaps:
            deduped.append(tactic)

    if not deduped:
        overall = 0
    else:
        overall = min(int(sum(tactic.intensityScore for tactic in deduped) / len(deduped) * 100), 100)

    label = "None" if overall < 10 else "Low" if overall < 30 else "Moderate" if overall < 55 else "High" if overall < 75 else "Severe"

    return ManipulationResponse(
        tacticsDetected=deduped,
        overallManipulationScore=overall,
        manipulationLabel=label,
        latencyMs=(time.time() - start) * 1000,
    )
