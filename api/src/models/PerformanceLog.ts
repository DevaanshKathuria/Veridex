import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export interface IPerformanceLog {
  analysisId: Types.ObjectId;
  totalLatencyMs: number;
  extractionLatencyMs: number;
  retrievalLatencyMs: number;
  rerankerLatencyMs: number;
  judgmentLatencyMs: number;
  scoringLatencyMs: number;
  cacheHitRate: number;
  claimsCount: number;
  chunksRetrieved: number;
  openaiTokensUsed: number;
  createdAt: Date;
}

export type PerformanceLogDocument = HydratedDocument<IPerformanceLog>;
type PerformanceLogModel = Model<IPerformanceLog>;

const PerformanceLogSchema = new Schema<IPerformanceLog>(
  {
    analysisId: {
      type: Schema.Types.ObjectId,
      ref: "Analysis",
      required: true,
    },
    totalLatencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    extractionLatencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    retrievalLatencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    rerankerLatencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    judgmentLatencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    scoringLatencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    cacheHitRate: {
      type: Number,
      default: 0,
      required: true,
    },
    claimsCount: {
      type: Number,
      default: 0,
      required: true,
    },
    chunksRetrieved: {
      type: Number,
      default: 0,
      required: true,
    },
    openaiTokensUsed: {
      type: Number,
      default: 0,
      required: true,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
  },
  {
    versionKey: false,
  },
);

const PerformanceLog =
  (models.PerformanceLog as PerformanceLogModel | undefined) ??
  model<IPerformanceLog>("PerformanceLog", PerformanceLogSchema);

export default PerformanceLog;
