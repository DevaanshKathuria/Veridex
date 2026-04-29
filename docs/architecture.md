# System Architecture

Veridex is a service-oriented monorepo. The API owns user-facing contracts and persistence, the worker owns long-running jobs, the ML service owns inference, and the client renders the realtime investigation workflow.

## Service Communication

```mermaid
sequenceDiagram
  participant Browser
  participant API
  participant Worker
  participant ML
  participant DB as MongoDB

  Browser->>API: POST /api/ingest { text }
  API->>DB: Create Document (PENDING)
  API->>Worker: Enqueue ingestion-job
  API-->>Browser: { documentId }
  
  Worker->>ML: POST /process/ingest
  ML-->>Worker: { cleanedText, sentences[] }
  Worker->>ML: POST /process/extract
  ML-->>Worker: { claims[] }
  Worker->>DB: Update Document (READY, claims embedded)
  Worker->>Browser: Socket: ingestion:complete
  
  Browser->>API: POST /api/analyze { documentId }
  API->>DB: Create Analysis (QUEUED)
  API->>Worker: Enqueue verification-job
  API-->>Browser: { analysisId }
  
  Worker->>ML: POST /process/retrieve { claims[], strategy }
  ML-->>Worker: { evidenceMap }
  Worker->>Browser: Socket: retrieval:progress per claim
  
  Worker->>ML: POST /process/verify { claims[], evidenceMap }
  ML-->>Worker: { verdicts[] }
  Worker->>Browser: Socket: verdict:ready per claim
  
  Worker->>ML: POST /process/manipulate
  ML-->>Worker: { tactics[], score }
  Worker->>Browser: Socket: manipulation:detected
  
  Worker->>ML: POST /process/score
  ML-->>Worker: { credibilityScore, label, summary }
  Worker->>DB: Update Analysis (COMPLETE)
  Worker->>Browser: Socket: analysis:complete
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
