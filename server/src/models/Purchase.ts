import { Schema, model, Document } from 'mongoose';

export interface IPurchaseOrderItem {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalPrice: number;
  receivedQuantity: number;
}
const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>({
  id: { type: String, required: true },
  inventoryItemId: { type: String, required: true, ref: 'InventoryItem' },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  receivedQuantity: { type: Number, default: 0 }
}, { _id: false });

export interface IPurchaseOrder extends Document {
  id: string;
  poNumber: string;
  purchaseRequestId?: string;
  supplierId: string;
  supplierName?: string;
  orderDate: string;
  deliveryDate?: string;
  items: IPurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'CANCELLED';
  approvedBy?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  id: { type: String, required: true, unique: true },
  poNumber: { type: String, required: true, unique: true, index: true },
  purchaseRequestId: { type: String },
  supplierId: { type: String, required: true, ref: 'Supplier' },
  supplierName: { type: String },
  orderDate: { type: String, required: true },
  deliveryDate: { type: String },
  items: [PurchaseOrderItemSchema],
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED'],
    default: 'PENDING'
  },
  approvedBy: { type: String, ref: 'User' },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

export interface IGoodsReceipt extends Document {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  receivedDate: string;
  receivedBy?: string;
  invoiceNumber?: string;
  notes?: string;
  createdAt: Date;
}
const GoodsReceiptSchema = new Schema<IGoodsReceipt>({
  id: { type: String, required: true, unique: true },
  grnNumber: { type: String, required: true, unique: true, index: true },
  purchaseOrderId: { type: String, required: true, ref: 'PurchaseOrder' },
  receivedDate: { type: String, required: true },
  receivedBy: { type: String, ref: 'User' },
  invoiceNumber: { type: String },
  notes: { type: String }
}, { timestamps: true });

export interface IPurchaseInvoice extends Document {
  id: string;
  invoiceNumber: string;
  purchaseOrderId?: string;
  supplierId: string;
  supplierName?: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  createdAt: Date;
  updatedAt: Date;
}
const PurchaseInvoiceSchema = new Schema<IPurchaseInvoice>({
  id: { type: String, required: true, unique: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  purchaseOrderId: { type: String, ref: 'PurchaseOrder' },
  supplierId: { type: String, required: true, ref: 'Supplier' },
  supplierName: { type: String },
  invoiceDate: { type: String, required: true },
  dueDate: { type: String },
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'], default: 'UNPAID' }
}, { timestamps: true });

export const PurchaseOrder = model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
export const GoodsReceipt = model<IGoodsReceipt>('GoodsReceipt', GoodsReceiptSchema);
export const PurchaseInvoice = model<IPurchaseInvoice>('PurchaseInvoice', PurchaseInvoiceSchema);
