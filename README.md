# Veridex

[![CI](https://github.com/DevaanshKathuria/Veridex/actions/workflows/ci.yml/badge.svg)](https://github.com/DevaanshKathuria/Veridex/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-ML_Service-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

`fact-checking` `retrieval-augmented-generation` `hybrid-search` `fastapi` `express` `nextjs` `bullmq` `mongodb` `pinecone` `elasticsearch` `evaluation`

> AI-powered real-time claim verification and media intelligence platform.

## What It Does

Veridex ingests articles, PDFs, transcripts, posts, and raw text, decomposes them into atomic factual claims, retrieves supporting and contradicting evidence, verifies each claim, detects manipulation tactics, and produces a calibrated credibility score. It is built for live analysis: the frontend receives extraction, retrieval, verdict, manipulation, and scoring events over Socket.IO while the worker runs the long-running pipeline.

The system is intentionally engineered as a production-style monorepo rather than a demo. Authentication, rate limiting, refresh tokens, dead-letter handling, Redis-backed queues, MongoDB persistence, hybrid retrieval, evaluation datasets, and benchmark scripts are all included so the project can be operated, measured, and improved.

## Architecture

```mermaid
graph TB
  Client["Next.js Client<br/>:3000"] -->|HTTP + WebSocket| API["Express API<br/>:4000"]
  API -->|HTTP| ML["FastAPI ML<br/>:8000"]
  API -->|BullMQ| Worker["BullMQ Worker"]
  Worker -->|HTTP| ML
  API --- MongoDB[("MongoDB Atlas / MongoDB")]
  API --- Redis[("Redis")]
  Worker --- MongoDB
  Worker --- Redis
  ML --- Pinecone[("Pinecone")]
  ML --- Elasticsearch[("Elasticsearch<br/>:9200")]
  ML --- Redis
```

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Client | Next.js 14, React, Tailwind CSS | Forensic dashboard UI |
| Client state | Zustand, TanStack Query | Auth/session state and API caching |
| Realtime | Socket.IO, Redis pub/sub | Live pipeline events from worker to browser |
| API | Express, TypeScript | Auth, routing, orchestration, ownership checks |
| Auth | JWT, bcrypt, httpOnly refresh cookies | Access control and session rotation |
| Queueing | BullMQ, Redis | Ingestion, verification, and dead-letter jobs |
| Persistence | MongoDB, Mongoose | Users, documents, analyses, logs |
| ML service | FastAPI, Pydantic | Python-native inference endpoints |
| Claim extraction | OpenAI, spaCy, sentence-transformers | Classification, atomic claims, entities, embeddings |
| Retrieval | Pinecone, Elasticsearch, RRF, cross-encoder | Hybrid evidence search and reranking |
| Verification | GPT-4o, NLI, temporal/numerical checks | Verdicts and evidence sufficiency |
| Evaluation | Python scripts, JSON datasets | Extraction, retrieval, verification, manipulation, latency benchmarks |
| Deployment | Docker Compose, GitHub Actions | Local orchestration and CI |

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Node.js 20+
- Python 3.11+
- Accounts/keys: MongoDB Atlas or local MongoDB, Pinecone, OpenAI

### 1. Clone and Configure

```bash
git clone https://github.com/DevaanshKathuria/Veridex
cd Veridex
cp .env.example .env
# Fill in all values in .env
```

For Docker Compose, keep service URLs pointed at Compose hostnames such as `mongodb`, `redis`, `ml`, and `elasticsearch`. For host-local development, use `localhost` equivalents.

### 2. Start All Services

```bash
docker-compose up --build
```

Health checks:

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

### 3. Seed the Knowledge Base

```bash
docker-compose exec worker npx ts-node scripts/seedKnowledgeBase.ts
```

### 4. Run Evaluation

```bash
cd evaluation/scripts
python eval_extraction.py --live
python eval_retrieval.py --live
python eval_verification.py --live
python eval_manipulation.py
python eval_latency.py
python ../ablation/run_ablation.py --live
```

CI can run offline fixture checks without a live ML container:

```bash
python eval_extraction.py --fixture
python eval_retrieval.py --fixture
python eval_verification.py --fixture
python ../ablation/run_ablation.py --fixture
```

## Environment Variables

| Variable | Service | Description | Example |
| --- | --- | --- | --- |
| `PORT` | API | API listen port | `4000` |
| `MONGODB_URI` | API, Worker | MongoDB connection string | `mongodb://mongodb:27017/veridex` |
| `REDIS_URL` | API, Worker, ML | Redis connection string | `redis://redis:6379` |
| `JWT_ACCESS_SECRET` | API | JWT access token signing secret | `replace_with_32_chars` |
| `JWT_REFRESH_SECRET` | API | Refresh-token secret/future rotation key | `replace_with_32_chars` |
| `CLIENT_URL` | API | Browser origin for CORS/socket.io | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Client | Public API base URL used by browser | `http://localhost:4000` |
| `ML_SERVICE_URL` | API, Worker | Internal ML service URL | `http://ml:8000` |
| `WORKER_CONCURRENCY` | Worker | BullMQ worker concurrency | `3` |
| `ALERT_WEBHOOK` | Worker | Optional dead-letter alert webhook | `https://hooks.slack.com/...` |
| `ADMIN_EMAILS` | API | Comma-separated admin allowlist | `admin@example.com` |
| `REDIS_RATE_LIMITER` | API | `memory` for local, `redis` for shared rate limiting | `memory` |
| `NODE_ENV` | API, Worker, Client | Runtime environment | `development` |
| `OPENAI_API_KEY` | ML | OpenAI API key | `sk-...` |
| `PINECONE_API_KEY` | ML, Worker seed | Pinecone API key | `pcsk_...` |
| `PINECONE_INDEX_NAME` | ML, Worker seed | Pinecone index name | `veridex-kb` |
| `PINECONE_ENVIRONMENT` | Worker seed | Pinecone environment, if required by SDK/account | `us-east-1` |
| `ELASTICSEARCH_URL` | ML, Worker seed | Elasticsearch URL | `http://elasticsearch:9200` |
| `PIPELINE_VERSION` | ML | Version string surfaced by `/health` | `1.0.0` |

## API Reference

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | API and MongoDB health |
| `GET` | `/api` | No | API root metadata |
| `POST` | `/api/auth/register` | No | Create account and set refresh cookie |
| `POST` | `/api/auth/login` | No | Login and rotate refresh token |
| `POST` | `/api/auth/refresh` | Cookie | Issue a new access token |
| `POST` | `/api/auth/logout` | Cookie | Delete refresh token and clear cookie |
| `GET` | `/api/auth/me` | Bearer | Current user profile |
| `POST` | `/api/ingest` | Bearer | Ingest text, URL, PDF, transcript, tweet, or product text |
| `POST` | `/api/analyze` | Bearer | Create analysis and enqueue verification |
| `GET` | `/api/documents` | Bearer | Paginated user documents |
| `GET` | `/api/documents/:id` | Bearer | Full owned document |
| `GET` | `/api/documents/:id/status` | Bearer | Document readiness and counts |
| `DELETE` | `/api/documents/:id` | Bearer | Delete document and related analyses |
| `GET` | `/api/analyses` | Bearer | Paginated analyses |
| `GET` | `/api/analyses/:id` | Bearer | Full analysis report |
| `GET` | `/api/analyses/:id/share` | No | Public read for completed analysis |
| `DELETE` | `/api/analyses/:id` | Bearer | Delete owned analysis |
| `GET` | `/api/stats` | Bearer | User aggregate stats |
| `GET` | `/api/metrics` | Admin | System performance metrics |
| `POST` | `/api/admin/requeue/:jobId` | Admin | Requeue a dead-lettered job |

## Pipeline Overview

1. **Input**: The API validates text, URL, or upload input and creates a `Document`.
2. **Extract**: The ML service cleans text, segments sentences, and extracts atomic factual claims.
3. **Retrieve**: Pinecone dense search and Elasticsearch BM25 search are fused with RRF and reranked.
4. **Verify**: GPT/NLI/temporal/numerical checks produce per-claim verdicts and evidence.
5. **Score**: Manipulation tactics and verdict distributions produce a credibility score and summary.

## Evaluation Results

Live ML-service benchmark summary from [benchmark_report.md](evaluation/results/benchmark_report.md):

| Strategy | Recall@5 | MRR | nDCG@5 | Verify Acc |
| --- | ---: | ---: | ---: | ---: |
| dense_only | 0.567 | 0.412 | 0.489 | 0.625 |
| bm25_only | 0.633 | 0.518 | 0.571 | 0.700 |
| hybrid | 0.767 | 0.634 | 0.698 | 0.775 |
| hybrid_reranked | 0.833 | 0.721 | 0.779 | 0.825 |

Claim extraction F1 is `0.776`, verification accuracy is `0.750`, and manipulation detection macro F1 is `0.752`.

## Demo Flow

1. Start the stack with `docker-compose up --build`.
2. Seed evidence with `docker-compose exec worker npx ts-node scripts/seedKnowledgeBase.ts`.
3. Open `http://localhost:3000`, register, paste an article or claim bundle, and click **Analyze**.
4. Watch Socket.IO events stream pipeline progress from extraction through scoring.
5. Open the final analysis to inspect claim-level verdicts, evidence chunks, manipulation tactics, and score breakdown.

## Sample Analysis Output

```json
{
  "credibilityScore": 78,
  "confidenceBand": 6,
  "credibilityLabel": "High",
  "summary": "Most factual claims are supported by high-quality evidence, with one disputed statistic and low manipulation pressure.",
  "claims": [
    {
      "claimText": "Apple's revenue reached $383 billion in fiscal year 2023.",
      "verdict": "VERIFIED",
      "confidence": 91,
      "supportingEvidence": [
        {
          "chunkId": "apple-2023-10k-001",
          "source": "Apple Form 10-K",
          "reliabilityTier": 1,
          "rerankerScore": 0.92,
          "nliStance": "entailment"
        }
      ]
    },
    {
      "claimText": "The policy will definitely eliminate inflation within one year.",
      "verdict": "DISPUTED",
      "confidence": 68,
      "temporalVerdict": "time_sensitive",
      "reasoning": "Retrieved evidence does not support the certainty or time-bound guarantee."
    }
  ],
  "manipulationTactics": [
    {
      "tactic": "certainty_inflation",
      "excerpt": "definitely eliminate inflation within one year",
      "charOffset": 144,
      "charEnd": 190,
      "intensityScore": 0.81
    }
  ]
}
```

## Project Structure

```text
Veridex/
  api/          Express API, auth, routes, socket bridge, Mongoose models
  worker/       BullMQ jobs, dead-letter handling, knowledge-base seeding
  ml/           FastAPI service and ML pipelines
  client/       Next.js dashboard and realtime analysis UI
  evaluation/   Curated datasets, evaluators, ablations, benchmark results
  docs/         Architecture and design decision documents
  docker-compose.yml
  .env.example
```

## Deploy-Ready Checklist

- `docker-compose up --build` starts MongoDB, Redis, Elasticsearch, ML, API, Worker, and Client.
- `/health` on API and ML returns healthy responses.
- Auth, ingest, analyze, realtime socket events, and scoring complete end-to-end.
- Evaluation scripts run from `evaluation/scripts`.
- Knowledge base seed script runs from the worker service.
- TypeScript and Python compile checks pass in CI.
