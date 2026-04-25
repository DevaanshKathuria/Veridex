import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export type AnalysisStatus =
  | "QUEUED"
  | "CLEANING"
  | "EXTRACTING"
  | "RETRIEVING"
  | "RERANKING"
  | "JUDGING"
  | "SCORING"
  | "MANIPULATION"
  | "COMPLETE"
  | "FAILED"
  | "PARTIAL";

export interface IHighlightSpan {
  start: number;
  end: number;
}

export interface IEvidence {
  chunkId: string;
  chunkText: string;
  source: string;
  sourceUrl: string;
  reliabilityTier: 1 | 2 | 3 | 4;
  publicationDate: Date | null;
  rerankerScore: number;
  nliStance: "entailment" | "neutral" | "contradiction";
  nliConfidence: number;
  highlightSpans: IHighlightSpan[];
}

export interface IEntity {
  text: string;
  label: string;
  start: number;
  end: number;
}

export interface ITemporalContext {
  rawExpression: string | null;
  normalizedDate: string | null;
  isRelative: boolean;
}

export interface INumericalValue {
  value: number;
  unit: string;
  rawText: string;
}

export interface ISpoTriplet {
  subject: string;
  predicate: string;
  object: string;
}

export interface ISourceSpan {
  sentenceIndex: number;
  paragraphIndex: number;
  charOffset: number;
  charEnd: number;
}

export interface IStanceBreakdown {
  entailment: number;
  contradiction: number;
  neutral: number;
}

export interface IManipulationTactic {
  tactic: string;
  excerpt: string;
  charOffset: number;
  charEnd: number;
  intensityScore: number;
  explanation: string;
}

export interface IScoreBreakdown {
  verifiedRatioContribution: number;
  evidenceQualityContribution: number;
  manipulationPenaltyApplied: number;
  retrievalSufficiencyFactor: number;
}

export interface IClaim {
  claimId: string;
  claimText: string;
  normalizedClaim: string;
  claimType: string;
  entities: IEntity[];
  temporalContext: ITemporalContext;
  numericalValues: INumericalValue[];
  spo: ISpoTriplet;
  sourceSpan: ISourceSpan;
  verdict: string | null;
  temporalVerdict: string | null;
  confidence: number | null;
  reasoning: string | null;
  evidenceSufficiency: string | null;
  supportingEvidence: IEvidence[];
  contradictingEvidence: IEvidence[];
  stanceBreakdown: IStanceBreakdown;
  numericalConsistencyScore: number | null;
  calibrationOverrideApplied: boolean;
  processingStatus: "complete" | "failed" | "skipped" | "pending";
  extractionConfidence: number | null;
}

export interface IAnalysis {
  userId: Types.ObjectId;
  documentId: Types.ObjectId;
  status: AnalysisStatus;
  claims: IClaim[];
  manipulationTactics: IManipulationTactic[];
  credibilityScore: number | null;
  confidenceBand: number | null;
  credibilityLabel: "High" | "Moderate" | "Low" | "Very Low" | null;
  scoreBreakdown: IScoreBreakdown | null;
  summary: string | null;
  claimsCount: number;
  verifiedCount: number;
  disputedCount: number;
  falseCount: number;
  unsupportedCount: number;
  insufficientCount: number;
  avgConfidence: number | null;
  avgEvidenceQuality: number | null;
  processingTimeMs: number | null;
  pipelineVersion: string;
  errorMessage: string | null;
  completedAt: Date | null;
}

export type AnalysisDocument = HydratedDocument<IAnalysis>;
type AnalysisModel = Model<IAnalysis>;

const HighlightSpanSchema = new Schema<IHighlightSpan>(
  {
    start: Number,
    end: Number,
  },
  { _id: false },
);

const EvidenceSchema = new Schema<IEvidence>(
  {
    chunkId: String,
    chunkText: String,
    source: String,
    sourceUrl: String,
    reliabilityTier: { type: Number, default: 4 },
    publicationDate: { type: Date, default: null },
    rerankerScore: { type: Number, default: 0 },
    nliStance: { type: String, default: "neutral" },
    nliConfidence: { type: Number, default: 0 },
    highlightSpans: { type: [HighlightSpanSchema], default: [] },
  },
  { _id: false },
);

const EntitySchema = new Schema<IEntity>(
  {
    text: String,
    label: String,
    start: Number,
    end: Number,
  },
  { _id: false },
);

const TemporalContextSchema = new Schema<ITemporalContext>(
  {
    rawExpression: { type: String, default: null },
    normalizedDate: { type: String, default: null },
    isRelative: { type: Boolean, default: false },
  },
  { _id: false },
);

const NumericalValueSchema = new Schema<INumericalValue>(
  {
    value: Number,
    unit: String,
    rawText: String,
  },
  { _id: false },
);

const SpoSchema = new Schema<ISpoTriplet>(
  {
    subject: String,
    predicate: String,
    object: String,
  },
  { _id: false },
);

const SourceSpanSchema = new Schema<ISourceSpan>(
  {
    sentenceIndex: Number,
    paragraphIndex: Number,
    charOffset: Number,
    charEnd: Number,
  },
  { _id: false },
);

const StanceBreakdownSchema = new Schema<IStanceBreakdown>(
  {
    entailment: { type: Number, default: 0 },
    contradiction: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
  },
  { _id: false },
);

const ClaimSchema = new Schema<IClaim>(
  {
    claimId: String,
    claimText: String,
    normalizedClaim: String,
    claimType: String,
    entities: { type: [EntitySchema], default: [] },
    temporalContext: { type: TemporalContextSchema, default: () => ({ rawExpression: null, normalizedDate: null, isRelative: false }) },
    numericalValues: { type: [NumericalValueSchema], default: [] },
    spo: { type: SpoSchema, default: () => ({ subject: "", predicate: "", object: "" }) },
    sourceSpan: { type: SourceSpanSchema, default: () => ({ sentenceIndex: 0, paragraphIndex: 0, charOffset: 0, charEnd: 0 }) },
    verdict: { type: String, default: null },
    temporalVerdict: { type: String, default: null },
    confidence: { type: Number, default: null },
    reasoning: { type: String, default: null },
    evidenceSufficiency: { type: String, default: null },
    supportingEvidence: { type: [EvidenceSchema], default: [] },
    contradictingEvidence: { type: [EvidenceSchema], default: [] },
    stanceBreakdown: { type: StanceBreakdownSchema, default: () => ({ entailment: 0, contradiction: 0, neutral: 0 }) },
    numericalConsistencyScore: { type: Number, default: null },
    calibrationOverrideApplied: { type: Boolean, default: false },
    processingStatus: { type: String, default: "pending" },
    extractionConfidence: { type: Number, default: null },
  },
  { _id: false },
);

const ManipulationTacticSchema = new Schema<IManipulationTactic>(
  {
    tactic: String,
    excerpt: String,
    charOffset: Number,
    charEnd: Number,
    intensityScore: Number,
    explanation: String,
  },
  { _id: false },
);

const ScoreBreakdownSchema = new Schema<IScoreBreakdown>(
  {
    verifiedRatioContribution: Number,
    evidenceQualityContribution: Number,
    manipulationPenaltyApplied: Number,
    retrievalSufficiencyFactor: Number,
  },
  { _id: false },
);

const AnalysisSchema = new Schema<IAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    status: { type: String, default: "QUEUED" },
    claims: { type: [ClaimSchema], default: [] },
    manipulationTactics: { type: [ManipulationTacticSchema], default: [] },
    credibilityScore: { type: Number, default: null },
    confidenceBand: { type: Number, default: null },
    credibilityLabel: { type: String, default: null },
    scoreBreakdown: { type: ScoreBreakdownSchema, default: null },
    summary: { type: String, default: null },
    claimsCount: { type: Number, default: 0 },
    verifiedCount: { type: Number, default: 0 },
    disputedCount: { type: Number, default: 0 },
    falseCount: { type: Number, default: 0 },
    unsupportedCount: { type: Number, default: 0 },
    insufficientCount: { type: Number, default: 0 },
    avgConfidence: { type: Number, default: null },
    avgEvidenceQuality: { type: Number, default: null },
    processingTimeMs: { type: Number, default: null },
    pipelineVersion: { type: String, default: () => process.env.PIPELINE_VERSION ?? "1.0.0" },
    errorMessage: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    collection: "analyses",
    timestamps: true,
  },
);

const Analysis = (models.Analysis as AnalysisModel | undefined) ?? model<IAnalysis>("Analysis", AnalysisSchema);

export default Analysis;
