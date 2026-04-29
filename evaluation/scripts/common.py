from __future__ import annotations

import json
import math
import os
import sys
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
EVAL_ROOT = REPO_ROOT / "evaluation"
DATASET_DIR = EVAL_ROOT / "datasets"
RESULTS_DIR = EVAL_ROOT / "results"

for path in (REPO_ROOT, REPO_ROOT / "ml"):
    value = str(path)
    if value not in sys.path:
        sys.path.insert(0, value)


VERDICTS = ["VERIFIED", "FALSE", "DISPUTED", "UNSUPPORTED", "INSUFFICIENT_EVIDENCE"]


def load_dataset(name: str) -> list[dict[str, Any]]:
    with (DATASET_DIR / name).open() as handle:
        return json.load(handle)


def write_results(name: str, payload: dict[str, Any]) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with (RESULTS_DIR / name).open("w") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def post_json(url: str, payload: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ML service returned HTTP {exc.code} for {url}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach live ML service at {url}: {exc.reason}") from exc


def word_similarity(a: str, b: str) -> float:
    a_words = {token.strip(".,;:!?()[]\"'").lower() for token in a.split()}
    b_words = {token.strip(".,;:!?()[]\"'").lower() for token in b.split()}
    a_words.discard("")
    b_words.discard("")
    return len(a_words & b_words) / max(len(a_words | b_words), 1)


def precision_recall_f1(tp: int, fp: int, fn: int) -> dict[str, float]:
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-9)
    return {"precision": precision, "recall": recall, "f1": f1}


def macro_f1(expected: list[str], predicted: list[str], labels: list[str] = VERDICTS) -> tuple[float, dict[str, dict[str, float]]]:
    per_class: dict[str, dict[str, float]] = {}
    for label in labels:
        tp = sum(1 for gold, pred in zip(expected, predicted) if gold == label and pred == label)
        fp = sum(1 for gold, pred in zip(expected, predicted) if gold != label and pred == label)
        fn = sum(1 for gold, pred in zip(expected, predicted) if gold == label and pred != label)
        per_class[label] = precision_recall_f1(tp, fp, fn)
    return sum(values["f1"] for values in per_class.values()) / max(len(labels), 1), per_class


def confusion_matrix(expected: list[str], predicted: list[str], labels: list[str] = VERDICTS) -> list[list[int]]:
    matrix = [[0 for _ in labels] for _ in labels]
    label_to_index = {label: index for index, label in enumerate(labels)}
    for gold, pred in zip(expected, predicted):
        if gold in label_to_index and pred in label_to_index:
            matrix[label_to_index[gold]][label_to_index[pred]] += 1
    return matrix


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    rank = (len(sorted_values) - 1) * pct
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return float(sorted_values[int(rank)])
    return float(sorted_values[lower] * (upper - rank) + sorted_values[upper] * (rank - lower))


def ndcg_at_k(ranked_ids: list[str], relevant_ids: set[str], k: int) -> float:
    dcg = 0.0
    for index, chunk_id in enumerate(ranked_ids[:k]):
        if chunk_id in relevant_ids:
            dcg += 1 / math.log2(index + 2)
    ideal_hits = min(len(relevant_ids), k)
    ideal = sum(1 / math.log2(index + 2) for index in range(ideal_hits))
    return dcg / ideal if ideal else 0.0


def lexical_rank(claim: str, candidate_ids: list[str], keywords: list[str], strategy: str) -> list[str]:
    tokens = set(claim.lower().replace(".", "").replace(",", "").split())
    keyword_tokens = {keyword.lower() for keyword in keywords}
    scored = []
    for index, chunk_id in enumerate(candidate_ids):
        chunk_tokens = set(chunk_id.lower().replace("-", " ").split())
        overlap = len(tokens & chunk_tokens) + len(keyword_tokens & chunk_tokens)
        strategy_bonus = {"dense_only": 0.0, "bm25_only": 0.1, "hybrid": 0.2, "hybrid_reranked": 0.35}.get(strategy, 0)
        scored.append((overlap + strategy_bonus - index * 0.01, chunk_id))
    return [chunk_id for _score, chunk_id in sorted(scored, reverse=True)]


def retrieval_metrics(rows: list[dict[str, Any]], retrieved: dict[str, list[str]], ks: tuple[int, ...] = (1, 3, 5, 10)) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    reciprocal_ranks: list[float] = []
    ndcg5: list[float] = []

    for k in ks:
        recall_hits = 0
        precision_values = []
        ndcg_values = []
        for row in rows:
            relevant = set(row["groundTruthChunkIds"])
            ranked = retrieved.get(row["id"], [])
            top_k = ranked[:k]
            recall_hits += int(bool(relevant & set(top_k)))
            precision_values.append(len(relevant & set(top_k)) / max(k, 1))
            ndcg_values.append(ndcg_at_k(ranked, relevant, k))
        metrics[f"recall@{k}"] = recall_hits / max(len(rows), 1)
        metrics[f"precision@{k}"] = sum(precision_values) / max(len(precision_values), 1)
        metrics[f"ndcg@{k}"] = sum(ndcg_values) / max(len(ndcg_values), 1)

    for row in rows:
        relevant = set(row["groundTruthChunkIds"])
        ranked = retrieved.get(row["id"], [])
        rr = 0.0
        for index, chunk_id in enumerate(ranked, start=1):
            if chunk_id in relevant:
                rr = 1 / index
                break
        reciprocal_ranks.append(rr)
        ndcg5.append(ndcg_at_k(ranked, relevant, 5))
    metrics["mrr"] = sum(reciprocal_ranks) / max(len(reciprocal_ranks), 1)
    metrics["ndcg@5"] = sum(ndcg5) / max(len(ndcg5), 1)
    return metrics


def print_confusion(labels: list[str], matrix: list[list[int]]) -> None:
    width = 11
    print("gold\\pred".ljust(width) + "".join(label[:10].ljust(width) for label in labels))
    for label, row in zip(labels, matrix):
        print(label[:10].ljust(width) + "".join(str(value).ljust(width) for value in row))


def verdict_from_claim_text(claim: str) -> str:
    lowered = claim.lower()
    if any(token in lowered for token in ["flat earth", "10% of their brain", "visible from space", "vaccines cause autism"]):
        return "FALSE"
    if any(token in lowered for token in ["best", "most effective", "will definitely", "caused primarily"]):
        return "DISPUTED"
    if any(token in lowered for token in ["private meeting", "internal memo", "unreleased", "undisclosed"]):
        return "INSUFFICIENT_EVIDENCE"
    if any(token in lowered for token in ["unpublished", "small town", "local contractor", "prototype"]):
        return "UNSUPPORTED"
    return "VERIFIED"


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}
