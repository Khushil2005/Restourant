import { Schema, model, Document } from 'mongoose';

export interface IQueueToken extends Document {
  id: string;
  tokenNumber: number;
  tokenCode: string; // e.g. T-101
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: 'WAITING' | 'CALLED' | 'RECALLED' | 'SKIPPED' | 'SEATED' | 'CANCELLED' | 'COMPLETED';
  tableId?: string;
  estimatedWaitMinutes: number;
  calledAt?: Date;
  seatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QueueTokenSchema = new Schema<IQueueToken>({
  id: { type: String, required: true, unique: true },
  tokenNumber: { type: Number, required: true },
  tokenCode: { type: String, required: true, unique: true, index: true },
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
  seatedAt: { type: Date }
}, { timestamps: true });

export const QueueToken = model<IQueueToken>('QueueToken', QueueTokenSchema);
