import { Schema, model, Document } from 'mongoose';

export interface IPaymentTransaction {
  id: string;
  method: 'CASH' | 'UPI' | 'CARD' | 'ONLINE';
  amount: number;
  transactionRef?: string;
  status: 'SUCCESS' | 'FAILED';
  createdAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>({
  id: { type: String, required: true },
  method: { type: String, enum: ['CASH', 'UPI', 'CARD', 'ONLINE'], required: true },
  amount: { type: Number, required: true },
  transactionRef: { type: String },
  status: { type: String, default: 'SUCCESS' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

export interface IPayment extends Document {
  id: string;
  paymentNumber: string;
  billId: string;
  orderId?: string;
  amount: number;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'ONLINE' | 'SPLIT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactions: IPaymentTransaction[];
  referenceNumber?: string;
  verifiedBy?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  id: { type: String, required: true, unique: true },
  paymentNumber: { type: String, required: true, unique: true, index: true },
  billId: { type: String, required: true, ref: 'Bill' },
  orderId: { type: String, ref: 'Order' },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'ONLINE', 'SPLIT'], required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
    default: 'COMPLETED'
  },
  transactions: [PaymentTransactionSchema],
  referenceNumber: { type: String },
  verifiedBy: { type: String, ref: 'User' },
  notes: { type: String },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

export const Payment = model<IPayment>('Payment', PaymentSchema);
