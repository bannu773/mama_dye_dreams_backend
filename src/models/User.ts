import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress {
  type: 'shipping' | 'billing';
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  cognitoId: string;
  email: string;
  name: string;
  phone?: string;
  addresses: IAddress[];
  role: 'customer' | 'admin';
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>({
  type: { 
    type: String, 
    enum: ['shipping', 'billing'], 
    required: true 
  },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema<IUser>(
  {
    cognitoId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true,
      index: true 
    },
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
    phone: { 
      type: String,
      trim: true 
    },
    addresses: [addressSchema],
    role: { 
      type: String, 
      enum: ['customer', 'admin'], 
      default: 'customer' 
    },
    isEmailVerified: { 
      type: Boolean, 
      default: false 
    },
  },
  { 
    timestamps: true,
    collection: 'users'
  }
);

// Index for searching
userSchema.index({ email: 1, name: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
