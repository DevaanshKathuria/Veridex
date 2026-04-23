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
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    inputType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    latencyMs: {
      type: Number,
      default: 0,
      required: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    charCount: {
      type: Number,
      default: 0,
      required: true,
    },
    sentenceCount: {
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

const IngestionLog =
  (models.IngestionLog as IngestionLogModel | undefined) ?? model<IIngestionLog>("IngestionLog", IngestionLogSchema);

export default IngestionLog;
