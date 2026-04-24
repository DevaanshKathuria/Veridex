import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export interface IIngestionLog {
  documentId: Types.ObjectId;
  inputType: string;
  status: "success" | "failed";
  latencyMs: number;
  errorMessage: string | null;
  charCount: number;
  sentenceCount: number;
  createdAt: Date;
}

export type IngestionLogDocument = HydratedDocument<IIngestionLog>;
type IngestionLogModel = Model<IIngestionLog>;

const IngestionLogSchema = new Schema<IIngestionLog>(
  {
    documentId: { type: Schema.Types.ObjectId, required: true, ref: "Document" },
    inputType: { type: String, required: true },
    status: { type: String, enum: ["success", "failed"], required: true },
    latencyMs: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    charCount: { type: Number, default: 0 },
    sentenceCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    collection: "ingestionlogs",
    versionKey: false,
  },
);

const IngestionLog =
  (models.IngestionLog as IngestionLogModel | undefined) ?? model<IIngestionLog>("IngestionLog", IngestionLogSchema);

export default IngestionLog;
