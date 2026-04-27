# System Architecture

Veridex is a service-oriented monorepo. The API owns user-facing contracts and persistence, the worker owns long-running jobs, the ML service owns inference, and the client renders the realtime investigation workflow.

## Service Communication

```mermaid
sequenceDiagram
  participant Client as Next.js Client
  participant API as Express API
  participant Mongo as MongoDB
  participant Redis as Redis/BullMQ
  participant Worker as BullMQ Worker
  participant ML as FastAPI ML

  Client->>API: POST /api/ingest
  API->>ML: POST /process/ingest
  ML-->>API: cleaned text, sentences, contentHash
  API->>Mongo: Create Document
  API->>Redis: Enqueue ingestion job
  API-->>Client: documentId
  Worker->>Redis: Consume ingestion job
  Worker->>Mongo: Mark Document READY
  Worker->>Redis: Publish ingestion:complete
  API->>Client: Socket event ingestion:complete

  Client->>API: POST /api/analyze
  API->>ML: POST /process/extract
  ML-->>API: atomic claims
  API->>Mongo: Create Analysis
  API->>Redis: Enqueue verification job
  API-->>Client: analysisId

  Worker->>Mongo: Load Analysis + Document
  Worker->>ML: POST /process/retrieve
  ML-->>Worker: evidence map
  Worker->>ML: POST /process/verify
  ML-->>Worker: verdicts
  Worker->>Redis: Publish verdict:ready events
  API->>Client: Socket verdict:ready events
  Worker->>ML: POST /process/manipulate
  ML-->>Worker: manipulation tactics
  Worker->>ML: POST /process/score
  ML-->>Worker: final score
  Worker->>Mongo: Save COMPLETE analysis
  Worker->>Redis: Publish analysis:complete
  API->>Client: Socket analysis:complete
```

## Data Flow

1. The user submits text, a URL, or a file from the client.
2. The API authenticates the user, validates input, and asks the ML service to normalize/segment content.
3. The API stores a `Document` and enqueues background processing in BullMQ.
4. The user starts analysis; the API checks ownership, plan limits, document readiness, and seeds an `Analysis` with extracted claims.
5. The worker retrieves evidence for every claim using hybrid retrieval.
6. The worker asks the ML service to verify claims with evidence, temporal reasoning, and numerical checks.
7. The worker emits realtime claim verdict events through Redis pub/sub and Socket.IO.
8. Manipulation detection and credibility scoring run after verification.
9. The final `Analysis` embeds claims, evidence, manipulation tactics, score breakdown, and summary for a single-read report.

## MongoDB Schema

```mermaid
erDiagram
  USER ||--o{ DOCUMENT : owns
  USER ||--o{ ANALYSIS : runs
  USER ||--o{ REFRESH_TOKEN : has
  DOCUMENT ||--o{ ANALYSIS : analyzed_by
  ANALYSIS ||--o{ RETRIEVAL_LOG : records
  ANALYSIS ||--o{ PERFORMANCE_LOG : measures
  DOCUMENT ||--o{ INGESTION_LOG : records
  DEAD_LETTER_LOG }o--|| ANALYSIS : may_reference

  USER {
    ObjectId _id
    string name
    string email
    string passwordHash
    string plan
    number analysesCount
    number dailyAnalysesUsed
  }

  DOCUMENT {
    ObjectId _id
    ObjectId userId
    string inputType
    string status
    string contentHash
    string cleanedText
    array sentences
    number charCount
  }

  ANALYSIS {
    ObjectId _id
    ObjectId userId
    ObjectId documentId
    string status
    array claims
    array manipulationTactics
    number credibilityScore
    number confidenceBand
    object scoreBreakdown
    string summary
  }
```

## Retrieval Pipeline

```mermaid
flowchart LR
  Claim["Atomic Claim"] --> Dense["Dense Retrieval<br/>Pinecone"]
  Claim --> BM25["BM25 Retrieval<br/>Elasticsearch"]
  Dense --> RRF["RRF Fusion"]
  BM25 --> RRF
  RRF --> Rerank["Cross-Encoder Rerank<br/>Top 20"]
  Rerank --> Diversity["Diversity Filter"]
  Diversity --> NLI["NLI Stance Labeling"]
  NLI --> TopChunks["Top 6 Evidence Chunks"]
```

## Runtime Responsibilities

| Service | Responsibilities |
| --- | --- |
| Client | Auth screens, analysis workspace, dashboards, document management, realtime rendering |
| API | Auth, validation, ownership, plan limits, route contracts, queue enqueueing, socket bridge |
| Worker | Ingestion finalization, retrieval/verification orchestration, performance logs, dead letters |
| ML | Text processing, extraction, retrieval, verification, manipulation detection, scoring |
| Redis | BullMQ queues, cache, socket event pub/sub |
| MongoDB | Durable product data and analysis reports |
| Pinecone/Elasticsearch | Evidence retrieval indexes |
