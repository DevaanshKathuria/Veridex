import { HydratedDocument, Model, Schema, Types, model, models } from "mongoose";

export interface IRefreshToken {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;
type RefreshTokenModel = Model<IRefreshToken>;

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
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

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken =
  (models.RefreshToken as RefreshTokenModel | undefined) ??
  model<IRefreshToken>("RefreshToken", RefreshTokenSchema);

export default RefreshToken;
