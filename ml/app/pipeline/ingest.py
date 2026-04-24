import base64
import io
import re
import unicodedata
import uuid
from hashlib import sha256
from typing import Any

import pdfplumber
import spacy
from fastapi import HTTPException
from langdetect import LangDetectException, detect
from pydantic import BaseModel, Field


def _load_ingest_nlp() -> Any:
    try:
        model = spacy.load("en_core_web_sm", disable=["ner", "parser", "lemmatizer", "tagger", "textcat"])
    except OSError:
        model = spacy.blank("en")

    if "sentencizer" not in model.pipe_names:
        model.add_pipe("sentencizer")

    return model


nlp = _load_ingest_nlp()

ENCODING_ARTIFACTS = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u00a0": " ",
}


class SentenceDTO(BaseModel):
    index: int
    text: str
    paragraphIndex: int
    charOffset: int
    charEnd: int


class IngestRequest(BaseModel):
    text: str
    inputType: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    documentId: str
    cleanedText: str
    sentences: list[SentenceDTO]
    paragraphs: list[str]
    language: str
    charCount: int
    sentenceCount: int
    contentHash: str
    metadata: dict[str, Any]


def _extract_pdf_text(pdf_base64: str) -> str:
    raw = base64.b64decode(pdf_base64)
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages.append(page_text.strip())
    return "\n\n".join(pages).strip()


def _clean_text(text: str) -> str:
    cleaned = unicodedata.normalize("NFKC", text)
    for bad, good in ENCODING_ARTIFACTS.items():
        cleaned = cleaned.replace(bad, good)

    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"[ \t]{3,}", "  ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n[ \t]+", "\n", cleaned)
    return cleaned.strip()


def _paragraph_boundaries(cleaned_text: str) -> tuple[list[str], list[tuple[int, int]]]:
    paragraphs: list[str] = []
    boundaries: list[tuple[int, int]] = []

    for match in re.finditer(r"[^\n]+(?:\n(?!\n)[^\n]+)*", cleaned_text):
        paragraph = match.group(0).strip()
        if paragraph:
            paragraphs.append(paragraph)
            boundaries.append((match.start(), match.end()))

    if not paragraphs and cleaned_text:
        paragraphs = [cleaned_text]
        boundaries = [(0, len(cleaned_text))]

    return paragraphs, boundaries


def _paragraph_index_for_offset(offset: int, boundaries: list[tuple[int, int]]) -> int:
    for index, (start, end) in enumerate(boundaries):
        if start <= offset < end or (offset == end and index == len(boundaries) - 1):
            return index
    return max(len(boundaries) - 1, 0)


def _extract_source_metadata(input_type: str, metadata: dict[str, Any]) -> dict[str, Any]:
    if input_type in {"article_url", "pdf_upload"}:
        return {
            "sourceUrl": metadata.get("sourceUrl") or metadata.get("url") or "",
            "sourceTitle": metadata.get("sourceTitle") or metadata.get("title") or "",
            "sourceAuthor": metadata.get("sourceAuthor") or metadata.get("author"),
            "sourceDate": metadata.get("sourceDate") or metadata.get("date"),
        }

    return {
        "sourceUrl": "",
        "sourceTitle": "",
        "sourceAuthor": None,
        "sourceDate": None,
    }


async def process_ingest(req: IngestRequest) -> IngestResponse:
    source_text = req.text
    if req.inputType == "pdf_upload" and req.metadata.get("pdfBase64"):
        source_text = _extract_pdf_text(str(req.metadata["pdfBase64"]))

    if not source_text.strip():
        raise HTTPException(status_code=400, detail="No text content provided for ingestion")

    cleaned_text = _clean_text(source_text)

    try:
        language = detect(cleaned_text)
    except LangDetectException as exc:
        raise HTTPException(status_code=400, detail="Unable to detect language") from exc

    if language != "en":
        raise HTTPException(status_code=400, detail="Only English text is supported")

    content_hash = sha256(cleaned_text.encode()).hexdigest()

    doc = nlp(cleaned_text)
    paragraphs, boundaries = _paragraph_boundaries(cleaned_text)

    sentences: list[SentenceDTO] = []
    for sentence_index, sentence in enumerate(doc.sents):
        text = sentence.text.strip()
        if not text:
            continue

        char_offset = sentence.start_char
        char_end = sentence.end_char
        paragraph_index = _paragraph_index_for_offset(char_offset, boundaries)

        sentences.append(
            SentenceDTO(
                index=sentence_index,
                text=text,
                paragraphIndex=paragraph_index,
                charOffset=char_offset,
                charEnd=char_end,
            )
        )

    metadata = _extract_source_metadata(req.inputType, req.metadata)

    return IngestResponse(
        documentId=str(uuid.uuid4()),
        cleanedText=cleaned_text,
        sentences=sentences,
        paragraphs=paragraphs,
        language=language,
        charCount=len(cleaned_text),
        sentenceCount=len(sentences),
        contentHash=content_hash,
        metadata=metadata,
    )
