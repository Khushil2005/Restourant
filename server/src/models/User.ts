import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';
  avatarUrl?: string;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLogin?: Date;
  permissionOverrides?: any[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String },
  roleId: { type: String, required: true, ref: 'Role' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED'], default: 'ACTIVE' },
  avatarUrl: { type: String },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  lastLogin: { type: Date },
  permissionOverrides: { type: Array, default: [] }
}, { timestamps: true });

export interface IUserSession extends Document {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema = new Schema<IUserSession>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true, ref: 'User' },
  tokenHash: { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);
export const UserSession = model<IUserSession>('UserSession', UserSessionSchema);
