# Design Decisions

## 1. MongoDB Over PostgreSQL

MongoDB is a natural fit for Veridex because the primary read path is “load one complete analysis report.” Claims are embedded subdocuments inside an `Analysis`, so a single `Analysis.findById()` returns verdicts, evidence, manipulation findings, and score breakdown with zero JOIN cost.

The claim schema is variable: numerical claims, temporal claims, identity claims, and causal claims carry different supporting fields. A document model handles this variation without sparse relational tables or excessive nullable columns.

MongoDB TTL indexes also fit the auth model. Refresh token expiry can be handled by MongoDB index expiration rather than a cron cleanup job.

## 2. Hybrid Retrieval Over Vector-Only

Vector-only search is strong for paraphrase and semantic similarity, but it can miss exact evidence anchors: entity names, dates, law names, company names, and statistics. BM25 catches those exact keyword matches.

Dense retrieval handles semantic matches such as “revenue” versus “sales” or “founded” versus “established.” BM25 handles precise anchors such as `383 billion`, `Berlin`, or `March 11, 2020`.

Veridex combines both with reciprocal rank fusion. RRF is parameter-light, robust, and avoids overfitting score scales across Pinecone and Elasticsearch.

Ablation evidence from the current benchmark:

| Strategy | Recall@5 | MRR | nDCG@5 |
| --- | ---: | ---: | ---: |
| dense_only | 0.667 | 0.298 | 0.398 |
| bm25_only | 0.900 | 0.783 | 0.814 |
| hybrid | 1.000 | 0.867 | 0.914 |
| hybrid_reranked | 1.000 | 1.000 | 1.000 |

The benchmark shows a +50.0% Recall@5 improvement for hybrid over dense-only and a +191.2% MRR improvement for the best reranked strategy over dense-only.

## 3. Cross-Encoder Reranking Over Bi-Encoder Only

Bi-encoders generate query and document embeddings independently. That is efficient, but it misses fine-grained interactions between a claim and a candidate evidence chunk.

A cross-encoder processes the `(claim, evidence)` pair jointly. It can distinguish a chunk that merely mentions the right entities from a chunk that actually supports or contradicts the claim.

The trade-off is latency: reranking requires O(N) forward passes. Veridex limits N to the top 20 fused candidates, making the relevance gain worth the cost.

## 4. Separate Python ML Service

The ML stack is Python-native. `sentence-transformers`, spaCy, BART-NLI, Pinecone’s Python SDK path, and the broader evaluation ecosystem are much stronger in Python than Node.js.

Separating ML behind FastAPI also enables independent scaling. The API is I/O-bound and handles auth/orchestration; the ML service is CPU/GPU-bound and handles inference. They can be scaled, profiled, and deployed independently.

This separation keeps code ownership clean: TypeScript services manage product workflows, Python services manage model workflows.

## 5. BullMQ Over Agenda

BullMQ is built around Redis and high-throughput job queues. It has first-class concurrency settings per queue, retry controls, and clean failure hooks that make dead-letter handling straightforward.

Agenda stores jobs in MongoDB and polls for work. That is simple, but polling adds operational load to the same database serving the product read path. Redis-backed queues are a better fit for bursty ingestion and verification workloads.

BullMQ also makes it easy to separate ingestion, verification, and dead-letter queues without inventing custom job state machines.

## 6. Embedded Claims vs Separate Collection

Claims are embedded inside `Analysis` because the primary user experience is reading a complete report. A single document returns every claim, verdict, evidence snippet, manipulation tactic, and score.

This avoids aggregation for the hottest read path and simplifies public share links.

The trade-off is MongoDB’s 16MB document limit. Veridex mitigates this by capping analyses at a practical number of claims and evidence chunks, currently designed around a maximum of roughly 50 claims per analysis.

## 7. Known Limitations

Knowledge base staleness is the largest product risk. A daily re-indexing job and RSS/news ingestion loop are needed in production.

GPT-4o verification has real cost. The benchmark estimates roughly cents per full analysis depending on claim count and evidence volume; production should track token usage per user and cache repeated analyses.

The system is currently English-first. Non-English text is detected, but the model path is not yet fully multilingual.

The project does not use fine-tuned extraction or stance models yet. Zero-shot and prompted methods are flexible, but a FEVER-style fine-tuned stance classifier would improve calibration and reduce cost.
