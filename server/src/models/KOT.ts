import { Schema, model, Document } from 'mongoose';

export interface IKOTItem {
  id: string;
  orderItemId?: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  notes?: string;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
}

const KOTItemSchema = new Schema<IKOTItem>({
  id: { type: String, required: true },
  orderItemId: { type: String },
  menuItemId: { type: String, required: true, ref: 'MenuItem' },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  notes: { type: String },
  status: { type: String, enum: ['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'], default: 'NEW' }
}, { _id: false });

export interface IKOTTicket extends Document {
  id: string;
  kotNumber: string;
  orderId: string;
  tableId?: string;
  tableNumber?: string;
  orderType: string;
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  chefNotes?: string;
  items: IKOTItem[];
  acceptedAt?: Date;
  preparingAt?: Date;
  readyAt?: Date;
  servedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KOTTicketSchema = new Schema<IKOTTicket>({
  id: { type: String, required: true, unique: true },
  kotNumber: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, ref: 'Order' },
  tableId: { type: String, ref: 'DiningTable' },
  tableNumber: { type: String },
  orderType: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
    default: 'NEW'
  },
  priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
  chefNotes: { type: String },
  items: [KOTItemSchema],
  acceptedAt: { type: Date },
  preparingAt: { type: Date },
  readyAt: { type: Date },
  servedAt: { type: Date },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

export const KOTTicket = model<IKOTTicket>('KOTTicket', KOTTicketSchema);
