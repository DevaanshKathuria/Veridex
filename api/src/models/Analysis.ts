import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export type ReliabilityTier = 1 | 2 | 3 | 4;
export type NliStance = "entailment" | "neutral" | "contradiction";
export type ClaimType = "statistic" | "historical" | "scientific" | "causal" | "identity" | "comparative";
export type ClaimVerdict =
  | "VERIFIED"
  | "DISPUTED"
  | "FALSE"
  | "UNSUPPORTED"
  | "INSUFFICIENT_EVIDENCE";
export type TemporalVerdict = "VERIFIED_AT_TIME" | "OUTDATED" | "TEMPORALLY_UNCERTAIN";
export type EvidenceSufficiency = "high" | "medium" | "low";
export type ClaimProcessingStatus = "complete" | "failed" | "skipped" | "pending";
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
  reliabilityTier: ReliabilityTier;
  publicationDate: Date | null;
  rerankerScore: number;
  nliStance: NliStance;
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

export interface IClaim {
  claimId: string;
  claimText: string;
  normalizedClaim: string;
  claimType: ClaimType;
  entities: IEntity[];
  temporalContext: ITemporalContext;
  numericalValues: INumericalValue[];
  spo: ISpoTriplet;
  sourceSpan: ISourceSpan;
  verdict: ClaimVerdict | null;
  temporalVerdict: TemporalVerdict | null;
  confidence: number | null;
  reasoning: string | null;
  evidenceSufficiency: EvidenceSufficiency | null;
  supportingEvidence: IEvidence[];
  contradictingEvidence: IEvidence[];
  stanceBreakdown: IStanceBreakdown;
  numericalConsistencyScore: number | null;
  calibrationOverrideApplied: boolean;
  processingStatus: ClaimProcessingStatus;
  extractionConfidence: number | null;
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
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export type AnalysisDocument = HydratedDocument<IAnalysis>;
type AnalysisModel = Model<IAnalysis>;

const HighlightSpanSchema = new Schema<IHighlightSpan>(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false },
);

const EvidenceSubdocSchema = new Schema<IEvidence>(
  {
    chunkId: { type: String, required: true },
    chunkText: { type: String, required: true },
    source: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    reliabilityTier: { type: Number, enum: [1, 2, 3, 4], required: true },
    publicationDate: { type: Date, default: null },
    rerankerScore: { type: Number, default: 0, required: true },
    nliStance: { type: String, enum: ["entailment", "neutral", "contradiction"], required: true },
    nliConfidence: { type: Number, default: 0, required: true },
    highlightSpans: { type: [HighlightSpanSchema], default: [], required: true },
  },
  { _id: false },
);

const EntitySchema = new Schema<IEntity>(
  {
    text: { type: String, required: true },
    label: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false },
);

const TemporalContextSchema = new Schema<ITemporalContext>(
  {
    rawExpression: { type: String, default: null },
    normalizedDate: { type: String, default: null },
    isRelative: { type: Boolean, default: false, required: true },
  },
  { _id: false },
);

const NumericalValueSchema = new Schema<INumericalValue>(
  {
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    rawText: { type: String, required: true },
  },
  { _id: false },
);

const SpoTripletSchema = new Schema<ISpoTriplet>(
  {
    subject: { type: String, required: true },
    predicate: { type: String, required: true },
    object: { type: String, required: true },
  },
  { _id: false },
);

const SourceSpanSchema = new Schema<ISourceSpan>(
  {
    sentenceIndex: { type: Number, required: true },
    paragraphIndex: { type: Number, required: true },
    charOffset: { type: Number, required: true },
    charEnd: { type: Number, required: true },
  },
  { _id: false },
);

const StanceBreakdownSchema = new Schema<IStanceBreakdown>(
  {
    entailment: { type: Number, default: 0, required: true },
    contradiction: { type: Number, default: 0, required: true },
    neutral: { type: Number, default: 0, required: true },
  },
  { _id: false },
);

const ClaimSubdocSchema = new Schema<IClaim>(
  {
    claimId: { type: String, required: true },
    claimText: { type: String, required: true },
    normalizedClaim: { type: String, required: true },
    claimType: {
      type: String,
      enum: ["statistic", "historical", "scientific", "causal", "identity", "comparative"],
      required: true,
    },
    entities: { type: [EntitySchema], default: [], required: true },
    temporalContext: {
      type: TemporalContextSchema,
      default: () => ({
        rawExpression: null,
        normalizedDate: null,
        isRelative: false,
      }),
      required: true,
    },
    numericalValues: { type: [NumericalValueSchema], default: [], required: true },
    spo: {
      type: SpoTripletSchema,
      required: true,
    },
    sourceSpan: {
      type: SourceSpanSchema,
      required: true,
    },
    verdict: {
      type: String,
      enum: ["VERIFIED", "DISPUTED", "FALSE", "UNSUPPORTED", "INSUFFICIENT_EVIDENCE"],
      default: null,
    },
    temporalVerdict: {
      type: String,
      enum: ["VERIFIED_AT_TIME", "OUTDATED", "TEMPORALLY_UNCERTAIN"],
      default: null,
    },
    confidence: { type: Number, default: null },
    reasoning: { type: String, default: null },
    evidenceSufficiency: {
      type: String,
      enum: ["high", "medium", "low"],
      default: null,
    },
    supportingEvidence: { type: [EvidenceSubdocSchema], default: [], required: true },
    contradictingEvidence: { type: [EvidenceSubdocSchema], default: [], required: true },
    stanceBreakdown: {
      type: StanceBreakdownSchema,
      default: () => ({
        entailment: 0,
        contradiction: 0,
        neutral: 0,
      }),
      required: true,
    },
    numericalConsistencyScore: { type: Number, default: null },
    calibrationOverrideApplied: { type: Boolean, default: false, required: true },
    processingStatus: {
      type: String,
      enum: ["complete", "failed", "skipped", "pending"],
      default: "pending",
      required: true,
    },
    extractionConfidence: { type: Number, default: null },
  },
  { _id: false },
);

const ManipulationTacticSubdocSchema = new Schema<IManipulationTactic>(
  {
    tactic: { type: String, required: true },
    excerpt: { type: String, required: true },
    charOffset: { type: Number, required: true },
    charEnd: { type: Number, required: true },
    intensityScore: { type: Number, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false },
);

const ScoreBreakdownSchema = new Schema<IScoreBreakdown>(
  {
    verifiedRatioContribution: { type: Number, required: true },
    evidenceQualityContribution: { type: Number, required: true },
    manipulationPenaltyApplied: { type: Number, required: true },
    retrievalSufficiencyFactor: { type: Number, required: true },
  },
  { _id: false },
);

const AnalysisSchema = new Schema<IAnalysis>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["QUEUED", "CLEANING", "EXTRACTING", "RETRIEVING", "RERANKING", "JUDGING", "SCORING", "MANIPULATION", "COMPLETE", "FAILED", "PARTIAL"],
      default: "QUEUED",
      required: true,
    },
    claims: {
      type: [ClaimSubdocSchema],
      default: [],
      required: true,
    },
    manipulationTactics: {
      type: [ManipulationTacticSubdocSchema],
      default: [],
      required: true,
    },
    credibilityScore: { type: Number, default: null },
    confidenceBand: { type: Number, default: null },
    credibilityLabel: {
      type: String,
      enum: ["High", "Moderate", "Low", "Very Low"],
      default: null,
    },
    scoreBreakdown: {
      type: ScoreBreakdownSchema,
      default: null,
    },
    summary: { type: String, default: null },
    claimsCount: { type: Number, default: 0, required: true },
    verifiedCount: { type: Number, default: 0, required: true },
    disputedCount: { type: Number, default: 0, required: true },
    falseCount: { type: Number, default: 0, required: true },
    unsupportedCount: { type: Number, default: 0, required: true },
    insufficientCount: { type: Number, default: 0, required: true },
    avgConfidence: { type: Number, default: null },
    avgEvidenceQuality: { type: Number, default: null },
    processingTimeMs: { type: Number, default: null },
    pipelineVersion: {
      type: String,
      default: () => process.env.PIPELINE_VERSION ?? "1.0.0",
      required: true,
    },
    errorMessage: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

const Analysis = (models.Analysis as AnalysisModel | undefined) ?? model<IAnalysis>("Analysis", AnalysisSchema);

export default Analysis;
