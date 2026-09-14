import { Schema, model, Document } from 'mongoose';

export interface IQueueToken extends Document {
  id: string;
  tokenNumber: number;
  tokenCode: string; // e.g. T-1, T-2
  tokenDate: string; // e.g. "2026-09-14" (YYYY-MM-DD)
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: 'WAITING' | 'CALLED' | 'RECALLED' | 'SKIPPED' | 'SEATED' | 'CANCELLED' | 'COMPLETED';
  tableId?: string;
  estimatedWaitMinutes: number;
  calledAt?: Date;
  seatedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QueueTokenSchema = new Schema<IQueueToken>({
  id: { type: String, required: true, unique: true },
  tokenNumber: { type: Number, required: true },
  tokenCode: { type: String, required: true, index: true },
  tokenDate: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  partySize: { type: Number, default: 2 },
  status: { 
    type: String, 
    enum: ['WAITING', 'CALLED', 'RECALLED', 'SKIPPED', 'SEATED', 'CANCELLED', 'COMPLETED'],
    default: 'WAITING'
  },
  tableId: { type: String, ref: 'DiningTable' },
  estimatedWaitMinutes: { type: Number, default: 15 },
  calledAt: { type: Date },
  seatedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date }
}, { timestamps: true });

// Compound indexes for fast daily queries and sorting
QueueTokenSchema.index({ tokenDate: 1, tokenNumber: 1 });
QueueTokenSchema.index({ tokenDate: 1, status: 1 });

export const QueueToken = model<IQueueToken>('QueueToken', QueueTokenSchema);
