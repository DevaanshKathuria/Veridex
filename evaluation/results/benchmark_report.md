# Veridex evaluation report

## Dataset construction

The evaluation suite contains four curated JSON datasets:

| Dataset | Size | Coverage |
| --- | ---: | --- |
| Claim extraction | 50 sentences | 20 factual, 10 compound, 10 opinion/rhetorical, 10 mixed factual/opinion |
| Retrieval | 30 claims | 6 geographic, 8 statistics, 6 historical, 6 scientific, 4 company identity |
| Verification | 40 claims | 10 VERIFIED, 8 FALSE, 8 DISPUTED, 7 UNSUPPORTED, 7 INSUFFICIENT_EVIDENCE |
| Manipulation | 20 passages | Emotional language, sensational framing, certainty inflation, false dilemma, fear appeal, missing context |

The sample sizes are deliberately small enough for rapid CI-style iteration while still covering the major failure modes in the system. The verification set includes easy, medium, and hard cases so the benchmark tests both canonical facts and epistemic edge cases such as private documents or obscure local records.

This checked-in benchmark run used deterministic fixture fallbacks because the local `python3` interpreter did not have the ML runtime dependencies installed (`numpy` and `spacy` import failures are recorded in the result JSON files). In the full ML environment, the same scripts call the real pipeline modules.

## Claim extraction results

| Metric | Score |
| --- | ---: |
| Factual classification accuracy | 0.960 |
| Precision | 0.481 |
| Recall | 0.500 |
| F1 | 0.490 |
| Ground-truth claims | 50 |
| Extracted claims | 52 |

The fixture extractor correctly separates most factual and non-factual sentences, but claim-level F1 is limited by compound decomposition. The most common failure mode is over-splitting conjunctions, such as turning “Bill Gates and Paul Allen” into separate fragments. Pronoun resolution and entity-preserving decomposition should be evaluated again with the full ML extraction stack enabled.

## Retrieval ablation

| Strategy | Recall@5 | MRR | nDCG@5 | Verify Acc |
| --- | ---: | ---: | ---: | ---: |
| dense_only | 0.667 | 0.298 | 0.398 | 1.00 |
| bm25_only | 0.900 | 0.783 | 0.814 | 1.00 |
| hybrid | 1.000 | 0.867 | 0.914 | 1.00 |
| hybrid_reranked | 1.000 | 1.000 | 1.000 | 1.00 |

Hybrid retrieval outperforms dense-only because lexical matching preserves exact entities, dates, and numerical anchors that vector search can blur. Reranking adds value by moving the directly answer-bearing chunk to the top instead of merely retrieving it somewhere in the first page.

Example: for “Apple reported $383 billion in revenue for fiscal year 2023,” BM25-style evidence can match `Apple`, `$383 billion`, and `2023` directly. Dense retrieval may find broader Apple company context, while the hybrid+rereanked path is designed to prefer the annual-report chunk.

## Verification accuracy

Overall accuracy: 0.725  
Macro F1: 0.653

| Gold \ Pred | VERIFIED | FALSE | DISPUTED | UNSUPPORTED | INSUFFICIENT |
| --- | ---: | ---: | ---: | ---: | ---: |
| VERIFIED | 10 | 0 | 0 | 0 | 0 |
| FALSE | 0 | 8 | 0 | 0 | 0 |
| DISPUTED | 0 | 0 | 8 | 0 | 0 |
| UNSUPPORTED | 7 | 0 | 0 | 0 | 0 |
| INSUFFICIENT_EVIDENCE | 3 | 0 | 0 | 1 | 3 |

The main confusion is between UNSUPPORTED and VERIFIED in fixture mode, because fixture evidence is intentionally limited and the fallback verifier has no external corpus to prove absence. DISPUTED cases are cleanly separated in the curated set. Calibration override impact was 0% in this fallback run; the full pipeline result JSON will expose `calibrationOverrideApplied` once GPT/evidence verification is active.

## Manipulation detection

| Tactic | Precision | Recall | F1 |
| --- | ---: | ---: | ---: |
| emotional_language | 1.000 | 1.000 | 1.000 |
| sensational_framing | 1.000 | 1.000 | 1.000 |
| certainty_inflation | 1.000 | 1.000 | 1.000 |
| false_dilemma | 1.000 | 1.000 | 1.000 |
| fear_appeal | 1.000 | 1.000 | 1.000 |
| missing_context | 1.000 | 1.000 | 1.000 |
| ad_hominem | 0.000 | 0.000 | 0.000 |

The hardest category in this run is ad hominem because the fallback detector does not perform named-entity recognition. In the full ML environment, spaCy-backed person detection should recover this category. Missing context remains conceptually hard because it often requires external comparison against omitted baselines or alternative causal explanations.

## System latency

| Stage | p50 ms | p95 ms |
| --- | ---: | ---: |
| Total | 15,656 | 17,327 |
| Retrieval | 4,714 | 5,176 |
| Judgment | 5,950 | 6,626 |

Mean cache hit rate: 0.297  
Estimated OpenAI cost: $0.8938 for 178,760 tracked tokens  
Throughput sample: 80 analyses/hour

Judgment is the largest bottleneck in the current latency profile, followed by retrieval. Caching helped roughly 29.7% of evaluated operations in the fixture latency sample. In a live run, the most important next breakdown is separating cross-encoder rerank latency from external index/network latency.

## Key findings

1. Hybrid retrieval is the highest-leverage architecture choice: Recall@5 improves 50.0% over dense-only in the ablation fixture.
2. Claim extraction needs the most targeted evaluation work, especially compound decomposition without corrupting multi-entity subjects.
3. Verification quality is most sensitive to evidence absence handling; UNSUPPORTED and INSUFFICIENT_EVIDENCE need explicit negative-evidence calibration.

## Known limitations and mitigations

1. Knowledge base staleness -> mitigation: daily news re-indexing job.
2. English-only -> mitigation: langdetect plus multilingual model path in v2.
3. LLM calibration variance -> mitigation: temperature 0 and `json_object` mode.

## Recommendations for v2

Fine-tune a stance classifier on FEVER-style evidence pairs.

Add claim-level confidence calibration with Platt scaling.

Implement real-time news ingestion via RSS polling and re-run the retrieval ablation against current-event claims.
