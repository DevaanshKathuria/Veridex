import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface IDeadLetterLog {
  queueName: string;
  jobId: string;
  jobData: Record<string, unknown>;
  errorStack: string;
  failedAt: Date;
  requeuedAt?: Date | null;
  requeuedJobId?: string | null;
}

export type DeadLetterLogDocument = HydratedDocument<IDeadLetterLog>;
type DeadLetterLogModel = Model<IDeadLetterLog>;

const DeadLetterLogSchema = new Schema<IDeadLetterLog>(
  {
    queueName: {
      type: String,
      required: true,
    },
    jobId: {
      type: String,
      required: true,
    },
    jobData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    errorStack: {
      type: String,
      required: true,
    },
    failedAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
    requeuedAt: {
      type: Date,
      default: null,
    },
    requeuedJobId: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
  },
);

const DeadLetterLog =
  (models.DeadLetterLog as DeadLetterLogModel | undefined) ??
  model<IDeadLetterLog>("DeadLetterLog", DeadLetterLogSchema);

export default DeadLetterLog;
