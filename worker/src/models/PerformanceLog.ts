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
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis", required: true },
    totalLatencyMs: { type: Number, default: 0 },
    extractionLatencyMs: { type: Number, default: 0 },
    retrievalLatencyMs: { type: Number, default: 0 },
    rerankerLatencyMs: { type: Number, default: 0 },
    judgmentLatencyMs: { type: Number, default: 0 },
    scoringLatencyMs: { type: Number, default: 0 },
    cacheHitRate: { type: Number, default: 0 },
    claimsCount: { type: Number, default: 0 },
    chunksRetrieved: { type: Number, default: 0 },
    openaiTokensUsed: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    collection: "performancelogs",
    versionKey: false,
  },
);

const PerformanceLog =
  (models.PerformanceLog as PerformanceLogModel | undefined) ?? model<IPerformanceLog>("PerformanceLog", PerformanceLogSchema);

export default PerformanceLog;
