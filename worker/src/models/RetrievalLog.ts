import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export interface IRetrievalLog {
  analysisId: Types.ObjectId;
  claimId: string;
  strategy: "dense_only" | "bm25_only" | "hybrid" | "hybrid_reranked";
  denseResults: number;
  bm25Results: number;
  fusedResults: number;
  rerankedResults: number;
  latencyMs: number;
  retrievedAt: Date;
}

export type RetrievalLogDocument = HydratedDocument<IRetrievalLog>;
type RetrievalLogModel = Model<IRetrievalLog>;

const RetrievalLogSchema = new Schema<IRetrievalLog>(
  {
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis", required: true },
    claimId: { type: String, required: true },
    strategy: { type: String, default: "hybrid_reranked" },
    denseResults: { type: Number, default: 0 },
    bm25Results: { type: Number, default: 0 },
    fusedResults: { type: Number, default: 0 },
    rerankedResults: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    retrievedAt: { type: Date, default: () => new Date() },
  },
  {
    collection: "retrievallogs",
    versionKey: false,
  },
);

const RetrievalLog =
  (models.RetrievalLog as RetrievalLogModel | undefined) ?? model<IRetrievalLog>("RetrievalLog", RetrievalLogSchema);

export default RetrievalLog;
