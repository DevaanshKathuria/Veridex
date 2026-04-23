import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface IUser {
  email: string;
  name: string;
  passwordHash: string;
  plan: "FREE" | "PRO";
  analysesCount: number;
  dailyAnalysesUsed: number;
  lastAnalysisDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;
type UserModel = Model<IUser>;

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    plan: {
      type: String,
      enum: ["FREE", "PRO"],
      default: "FREE",
      required: true,
    },
    analysesCount: {
      type: Number,
      default: 0,
      required: true,
    },
    dailyAnalysesUsed: {
      type: Number,
      default: 0,
      required: true,
    },
    lastAnalysisDate: {
      type: Date,
      default: () => new Date(0),
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const User = (models.User as UserModel | undefined) ?? model<IUser>("User", UserSchema);

export default User;
