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
  sourceDate: Date | null;
  language: string;
  charCount: number;
  sentenceCount: number;
  sentences: IDocumentSentence[];
  status: DocumentStatus;
  contentHash: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentDocument = HydratedDocument<IDocument>;
type DocumentModel = Model<IDocument>;

const DocumentSentenceSchema = new Schema<IDocumentSentence>(
  {
    index: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    paragraphIndex: {
      type: Number,
      required: true,
    },
    charOffset: {
      type: Number,
      required: true,
    },
    charEnd: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const DocumentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inputType: {
      type: String,
      enum: ["raw_text", "article_url", "pdf_upload", "transcript_upload", "tweet_text", "product_claim"],
      required: true,
    },
    rawText: {
      type: String,
      required: true,
    },
    cleanedText: {
      type: String,
      default: "",
      required: true,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    sourceTitle: {
      type: String,
      default: null,
    },
    sourceAuthor: {
      type: String,
      default: null,
    },
    sourceDate: {
      type: Date,
      default: null,
    },
    language: {
      type: String,
      default: "unknown",
      required: true,
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
    sentences: {
      type: [DocumentSentenceSchema],
      default: [],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CLEANING", "SEGMENTING", "EXTRACTING_CLAIMS", "EMBEDDING", "INDEXING", "READY", "FAILED"],
      default: "PENDING",
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Document = (models.Document as DocumentModel | undefined) ?? model<IDocument>("Document", DocumentSchema);

export default Document;
