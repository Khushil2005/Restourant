import { Schema, model, Document } from 'mongoose';

// Customer
export interface ICustomer extends Document {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  loyaltyPoints: number;
  totalSpent: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const CustomerSchema = new Schema<ICustomer>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  address: { type: String },
  city: { type: String },
  loyaltyPoints: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  notes: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Supplier
export interface ISupplier extends Document {
  id: string;
  name: string;
  companyName: string;
  email?: string;
  phone: string;
  taxId?: string;
  address?: string;
  paymentTerms?: string;
  outstandingBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const SupplierSchema = new Schema<ISupplier>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  companyName: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  taxId: { type: String },
  address: { type: String },
  paymentTerms: { type: String, default: 'NET30' },
  outstandingBalance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Department
export interface IDepartment extends Document {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}
const DepartmentSchema = new Schema<IDepartment>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Designation
export interface IDesignation extends Document {
  id: string;
  departmentId: string;
  title: string;
  description?: string;
  isActive: boolean;
}
const DesignationSchema = new Schema<IDesignation>({
  id: { type: String, required: true, unique: true },
  departmentId: { type: String, required: true, ref: 'Department' },
  title: { type: String, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Unit
export interface IUnit extends Document {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
}
const UnitSchema = new Schema<IUnit>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  symbol: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true }
});

// Tax Master
export interface ITaxMaster extends Document {
  id: string;
  name: string;
  rate: number;
  type: 'PERCENTAGE' | 'FIXED';
  isActive: boolean;
}
const TaxMasterSchema = new Schema<ITaxMaster>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  type: { type: String, enum: ['PERCENTAGE', 'FIXED'], default: 'PERCENTAGE' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Menu Category
export interface IMenuCategory extends Document {
  id: string;
  name: string;
  code: string;
  description?: string;
  displayOrder: number;
  imageUrl?: string;
  isActive: boolean;
}
const MenuCategorySchema = new Schema<IMenuCategory>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  displayOrder: { type: Number, default: 0 },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Menu Item
export interface IMenuItem extends Document {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  costPrice: number;
  taxId?: string;
  isVeg: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  imageUrl?: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
const MenuItemSchema = new Schema<IMenuItem>({
  id: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true, ref: 'MenuCategory' },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, index: true },
  description: { type: String },
  price: { type: Number, required: true },
  costPrice: { type: Number, default: 0 },
  taxId: { type: String, ref: 'TaxMaster' },
  isVeg: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  preparationTimeMinutes: { type: Number, default: 15 },
  imageUrl: { type: String },
  displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

// Floor Zone
export interface IFloorZone extends Document {
  id: string;
  name: string;
  code: string;
  description?: string;
  color?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FloorZoneSchema = new Schema<IFloorZone>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  color: { type: String, default: '#6366f1' },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Dining Table
export interface IDiningTable extends Document {
  id: string;
  tableNumber: string;
  capacity: number;
  floorZone: string;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING' | 'BLOCKED' | 'MAINTENANCE';
  currentOrderId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const DiningTableSchema = new Schema<IDiningTable>({
  id: { type: String, required: true, unique: true },
  tableNumber: { type: String, required: true, unique: true },
  capacity: { type: Number, default: 4 },
  floorZone: { type: String, default: 'MAIN_HALL' },
  status: { type: String, default: 'AVAILABLE' },
  currentOrderId: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
export const Supplier = model<ISupplier>('Supplier', SupplierSchema);
export const Department = model<IDepartment>('Department', DepartmentSchema);
export const Designation = model<IDesignation>('Designation', DesignationSchema);
export const Unit = model<IUnit>('Unit', UnitSchema);
export const TaxMaster = model<ITaxMaster>('TaxMaster', TaxMasterSchema);
export const MenuCategory = model<IMenuCategory>('MenuCategory', MenuCategorySchema);
export const MenuItem = model<IMenuItem>('MenuItem', MenuItemSchema);
export const FloorZone = model<IFloorZone>('FloorZone', FloorZoneSchema);
export const DiningTable = model<IDiningTable>('DiningTable', DiningTableSchema);

