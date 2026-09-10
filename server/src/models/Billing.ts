import { Schema, model, Document } from 'mongoose';

export interface IBillItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
}

const BillItemSchema = new Schema<IBillItem>({
  id: { type: String, required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 }
}, { _id: false });

export interface IBill extends Document {
  id: string;
  billNumber: string;
  orderId: string;
  tableId?: string;
  tableNumber?: string;
  customerId?: string;
  customerName?: string;
  items: IBillItem[];
  subtotal: number;
  discountRuleId?: string;
  discountAmount: number;
  discountApprovedBy?: string;
  taxAmount: number;
  serviceCharge: number;
  roundOff: number;
  totalPayable: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillSchema = new Schema<IBill>({
  id: { type: String, required: true, unique: true },
  billNumber: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, ref: 'Order' },
  tableId: { type: String, ref: 'DiningTable' },
  tableNumber: { type: String },
  customerId: { type: String, ref: 'Customer' },
  customerName: { type: String },
  items: [BillItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  discountRuleId: { type: String, ref: 'DiscountRule' },
  discountAmount: { type: Number, default: 0 },
  discountApprovedBy: { type: String, ref: 'User' },
  taxAmount: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  totalPayable: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED'],
    default: 'UNPAID'
  },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

export const Bill = model<IBill>('Bill', BillSchema);
