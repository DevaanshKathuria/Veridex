import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export type RetrievalStrategy = "dense_only" | "bm25_only" | "hybrid" | "hybrid_reranked";

export interface IRetrievalLog {
  analysisId: Types.ObjectId;
  claimId: string;
  strategy: RetrievalStrategy;
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
    analysisId: {
      type: Schema.Types.ObjectId,
      ref: "Analysis",
      required: true,
    },
    claimId: {
      type: String,
      required: true,
    },
    strategy: {
      type: String,
      enum: ["dense_only", "bm25_only", "hybrid", "hybrid_reranked"],
      required: true,
    },
    denseResults: {
      type: Number,
      default: 0,
      required: true,
    },
    bm25Results: {
      type: Number,
      default: 0,
      required: true,
    },
    fusedResults: {
      type: Number,
      default: 0,
      required: true,
    },
    rerankedResults: {
      type: Number,
      default: 0,
      required: true,
    },
    latencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    retrievedAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
  },
  {
    versionKey: false,
  },
);

const RetrievalLog =
  (models.RetrievalLog as RetrievalLogModel | undefined) ?? model<IRetrievalLog>("RetrievalLog", RetrievalLogSchema);

export default RetrievalLog;
