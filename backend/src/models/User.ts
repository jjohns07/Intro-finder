import mongoose, { Schema, type Document } from 'mongoose'

export interface IUserDocument extends Document {
  name: string
  email: string
  password: string
  createdAt: Date
  updatedAt: Date
  toSafeObject(): {
    id: string
    name: string
    email: string
    createdAt: Date
    updatedAt: Date
  }
}

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
  },
  {
    timestamps: true,
  }
)

userSchema.methods.toSafeObject = function (): {
  id: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
} {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  }
}

const User = mongoose.model<IUserDocument>('User', userSchema)

export default User
