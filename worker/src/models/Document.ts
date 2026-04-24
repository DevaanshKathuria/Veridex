import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export type DocumentInputType =
  | "raw_text"
  | "article_url"
  | "pdf_upload"
  | "transcript_upload"
  | "tweet_text"
  | "product_claim";

export type DocumentStatus =
  | "PENDING"
  | "CLEANING"
  | "SEGMENTING"
  | "EXTRACTING_CLAIMS"
  | "EMBEDDING"
  | "INDEXING"
  | "READY"
  | "FAILED";

export interface IDocumentSentence {
  index: number;
  text: string;
  paragraphIndex: number;
  charOffset: number;
  charEnd: number;
}

export interface IDocument {
  userId: Types.ObjectId;
  inputType: DocumentInputType;
  rawText: string;
  cleanedText: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  language: string;
  charCount: number;
  sentenceCount: number;
  sentences: IDocumentSentence[];
  status: DocumentStatus;
  contentHash: string;
  errorMessage: string | null;
}

export type DocumentDocument = HydratedDocument<IDocument>;
type DocumentModel = Model<IDocument>;

const SentenceSchema = new Schema<IDocumentSentence>(
  {
    index: Number,
    text: String,
    paragraphIndex: Number,
    charOffset: Number,
    charEnd: Number,
  },
  { _id: false },
);

const DocumentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    inputType: {
      type: String,
      enum: ["raw_text", "article_url", "pdf_upload", "transcript_upload", "tweet_text", "product_claim"],
      required: true,
    },
    rawText: { type: String, required: true },
    cleanedText: { type: String, default: "" },
    sourceUrl: { type: String, default: null },
    sourceTitle: { type: String, default: null },
    sourceAuthor: { type: String, default: null },
    language: { type: String, default: "unknown" },
    charCount: { type: Number, default: 0 },
    sentenceCount: { type: Number, default: 0 },
    sentences: { type: [SentenceSchema], default: [] },
    status: {
      type: String,
      enum: ["PENDING", "CLEANING", "SEGMENTING", "EXTRACTING_CLAIMS", "EMBEDDING", "INDEXING", "READY", "FAILED"],
      default: "PENDING",
    },
    contentHash: { type: String, required: true },
    errorMessage: { type: String, default: null },
  },
  {
    collection: "documents",
    timestamps: true,
  },
);

const Document = (models.Document as DocumentModel | undefined) ?? model<IDocument>("Document", DocumentSchema);

export default Document;
