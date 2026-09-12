import { Schema, model, Document } from 'mongoose';

// Chart of Accounts
export interface IChartOfAccount extends Document {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subType?: string;
  openingBalance?: number;
  currentBalance: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}
const ChartOfAccountSchema = new Schema<IChartOfAccount>({
  id: { type: String, required: true, unique: true },
  accountCode: { type: String, required: true, unique: true, index: true },
  accountName: { type: String, required: true, unique: true },
  accountType: { type: String, enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], required: true },
  subType: { type: String },
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Journal Entry Items
export interface IJournalItem {
  id: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}
const JournalItemSchema = new Schema<IJournalItem>({
  id: { type: String, required: true },
  accountId: { type: String, required: true, ref: 'ChartOfAccount' },
  accountName: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  description: { type: String }
}, { _id: false });

// Journal Entry
export interface IJournalEntry extends Document {
  id: string;
  entryNumber: string;
  entryDate: string;
  referenceType?: string; // SALES, PURCHASE, EXPENSE, PAYROLL, DAY_CLOSING, MANUAL
  referenceId?: string;
  narration: string;
  items: IJournalItem[];
  totalDebit: number;
  totalCredit: number;
  status: 'DRAFT' | 'POSTED' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdBy?: string;
  createdAt: Date;
}
const JournalEntrySchema = new Schema<IJournalEntry>({
  id: { type: String, required: true, unique: true },
  entryNumber: { type: String, required: true, unique: true, index: true },
  entryDate: { type: String, required: true },
  referenceType: { type: String },
  referenceId: { type: String },
  narration: { type: String, required: true },
  items: [JournalItemSchema],
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  status: { type: String, enum: ['DRAFT', 'POSTED', 'APPROVED', 'REJECTED'], default: 'POSTED' },
  approvedBy: { type: String, ref: 'User' },
  createdBy: { type: String, ref: 'User' }
}, { timestamps: true });

// Expense
export interface IExpense extends Document {
  id: string;
  expenseNumber: string;
  accountId: string;
  accountName?: string;
  title: string;
  category: 'RENT' | 'UTILITIES' | 'SALARIES' | 'SUPPLIES' | 'REPAIRS' | 'MARKETING' | 'MISC';
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'UPI';
  paymentAccountId?: string;
  expenseDate: string;
  receiptUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
const ExpenseSchema = new Schema<IExpense>({
  id: { type: String, required: true, unique: true },
  expenseNumber: { type: String, required: true, unique: true, index: true },
  accountId: { type: String, required: true, ref: 'ChartOfAccount' },
  accountName: { type: String },
  title: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentAccountId: { type: String, ref: 'ChartOfAccount' },
  expenseDate: { type: String, required: true },
  receiptUrl: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
  approvedBy: { type: String, ref: 'User' },
  createdBy: { type: String, ref: 'User' },
  notes: { type: String }
}, { timestamps: true });

// Day Closing
export interface IDayClosing extends Document {
  id: string;
  closingDate: string;
  openingCash: number;
  totalSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  otherSales: number;
  totalExpenses: number;
  cashExpenses: number;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
  totalOrders: number;
  status: 'OPEN' | 'CLOSED' | 'REOPENED';
  closedBy?: string;
  notes?: string;
  createdAt: Date;
}
const DayClosingSchema = new Schema<IDayClosing>({
  id: { type: String, required: true, unique: true },
  closingDate: { type: String, required: true, unique: true, index: true },
  openingCash: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  cashSales: { type: Number, default: 0 },
  upiSales: { type: Number, default: 0 },
  cardSales: { type: Number, default: 0 },
  otherSales: { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  cashExpenses: { type: Number, default: 0 },
  expectedCash: { type: Number, default: 0 },
  actualCash: { type: Number, default: 0 },
  cashDifference: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  status: { type: String, enum: ['OPEN', 'CLOSED', 'REOPENED'], default: 'CLOSED' },
  closedBy: { type: String, ref: 'User' },
  notes: { type: String }
}, { timestamps: true });

export const ChartOfAccount = model<IChartOfAccount>('ChartOfAccount', ChartOfAccountSchema);
export const JournalEntry = model<IJournalEntry>('JournalEntry', JournalEntrySchema);
export const Expense = model<IExpense>('Expense', ExpenseSchema);
export const DayClosing = model<IDayClosing>('DayClosing', DayClosingSchema);
