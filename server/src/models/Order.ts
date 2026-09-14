import { Schema, model, Document } from 'mongoose';

export interface IOrderItem {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  discountAmount: number;
  notes?: string;
  status: 'PENDING' | 'KOT_SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  createdAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  id: { type: String, required: true },
  menuItemId: { type: String, required: true, ref: 'MenuItem' },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  notes: { type: String },
  status: { type: String, default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

export interface IOrder extends Document {
  id: string;
  orderNumber: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';
  tableId?: string;
  tableNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  status: 'NEW' | 'IN_KITCHEN' | 'READY' | 'SERVED' | 'BILLED' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  items: IOrderItem[];
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  waiterId?: string;
  createdBy?: string;
  notes?: string;
  isHeld?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  id: { type: String, required: true, unique: true },
  orderNumber: { type: String, required: true, unique: true, index: true },
  orderType: { type: String, enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE'], default: 'DINE_IN' },
  tableId: { type: String, ref: 'DiningTable' },
  tableNumber: { type: String },
  customerId: { type: String, ref: 'Customer' },
  customerName: { type: String },
  customerPhone: { type: String },
  deliveryAddress: { type: String },
  status: { 
    type: String, 
    enum: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED', 'COMPLETED', 'CANCELLED', 'ON_HOLD'],
    default: 'NEW'
  },
  items: [OrderItemSchema],
  totalAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  netAmount: { type: Number, default: 0 },
  waiterId: { type: String, ref: 'User' },
  createdBy: { type: String, ref: 'User' },
  notes: { type: String },
  isHeld: { type: Boolean, default: false }
}, { timestamps: true });

export const Order = model<IOrder>('Order', OrderSchema);
