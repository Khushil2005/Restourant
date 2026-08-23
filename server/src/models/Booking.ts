import { Schema, model, Document } from 'mongoose';

export interface IBooking extends Document {
  id: string;
  bookingNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  tableId?: string;
  guestCount: number;
  advanceAmount?: number;
  functionType?: string;
  acceptedBy?: string;
  notes?: string;
  isLocked?: boolean;
  bookingDate: string; // YYYY-MM-DD
  bookingTime?: string; // HH:mm
  status: 'PENDING' | 'CONFIRMED' | 'LOCKED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';
  specialRequests?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  id: { type: String, required: true, unique: true },
  bookingNumber: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, ref: 'Customer' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  tableId: { type: String, ref: 'DiningTable' },
  guestCount: { type: Number, default: 2 },
  advanceAmount: { type: Number, default: 0 },
  functionType: { type: String, default: 'Family Dinner' },
  acceptedBy: { type: String },
  notes: { type: String },
  isLocked: { type: Boolean, default: true },
  bookingDate: { type: String, required: true, index: true },
  bookingTime: { type: String, default: '19:00' },
  status: { 
    type: String, 
    enum: ['PENDING', 'CONFIRMED', 'LOCKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED'],
    default: 'CONFIRMED'
  },
  specialRequests: { type: String },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

export const Booking = model<IBooking>('Booking', BookingSchema);
