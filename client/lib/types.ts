export type VerdictStatus =
  | "VERIFIED"
  | "DISPUTED"
  | "FALSE"
  | "UNSUPPORTED"
  | "INSUFFICIENT_EVIDENCE"
  | string;

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  plan: "FREE" | "PRO" | string;
  analysesCount?: number;
  dailyAnalysesUsed?: number;
}

export interface EvidenceChunk {
  chunkId?: string;
  chunkText?: string;
  excerpt?: string;
  source?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceType?: string;
  reliabilityTier?: number;
  publicationDate?: string;
  rerankerScore?: number;
  nliScore?: number;
  stance?: string;
}

export interface VerdictData {
  verdict: VerdictStatus;
  confidence?: number;
  reasoning?: string;
  sufficiencyScore?: number;
  temporalVerdict?: string;
}

export interface ClaimDTO {
  claimId: string;
  text: string;
  sentence?: string;
  charOffset?: number;
  charEnd?: number;
  subject?: string;
  predicate?: string;
  object?: string;
  spo?: {
    subject?: string;
    predicate?: string;
    object?: string;
  };
  verdict?: VerdictStatus | null;
  confidence?: number | null;
  reasoning?: string;
  temporalVerdict?: string;
  numericalValues?: Array<Record<string, unknown>>;
  numericalConsistencyScore?: number;
  supportingEvidence?: EvidenceChunk[];
  contradictingEvidence?: EvidenceChunk[];
}

export interface ManipulationTactic {
  tactic: string;
  excerpt: string;
  charOffset: number;
  charEnd: number;
  intensityScore: number;
  explanation: string;
}

export interface AnalysisDTO {
  _id: string;
  id?: string;
  documentId?: string;
  userId?: string;
  status: string;
  claims?: ClaimDTO[];
  manipulationTactics?: ManipulationTactic[];
  credibilityScore?: number;
  confidenceBand?: number;
  credibilityLabel?: string;
  scoreBreakdown?: Record<string, number>;
  summary?: string;
  claimsCount?: number;
  verifiedCount?: number;
  disputedCount?: number;
  falseCount?: number;
  inputSnippet?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentDTO {
  _id: string;
  id?: string;
  title?: string;
  fileName?: string;
  inputType?: string;
  sourceType?: string;
  status: string;
  charCount?: number;
  sentenceCount?: number;
  cleanedText?: string;
  sentences?: string[];
  createdAt?: string;
}

export interface StatsDTO {
  totalAnalyses: number;
  completedAnalyses: number;
  avgCredibilityScore: number;
  totalClaimsAnalyzed: number;
  verifiedTotal: number;
  falseTotal: number;
  disputedTotal: number;
  manipulationBreakdown: Record<string, number>;
  credibilityTrend: Array<{ date: string; score: number }>;
}
