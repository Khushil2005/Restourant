import { Schema, model, Document } from 'mongoose';

export interface IDiscountRule extends Document {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  requiresApproval: boolean;
  approvalRoleId?: string;
  applicableCategoryId?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DiscountRuleSchema = new Schema<IDiscountRule>({
  id: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['PERCENTAGE', 'FIXED_AMOUNT'], default: 'PERCENTAGE' },
  value: { type: Number, required: true },
  maxDiscountAmount: { type: Number },
  minOrderAmount: { type: Number, default: 0 },
  requiresApproval: { type: Boolean, default: false },
  approvalRoleId: { type: String, ref: 'Role' },
  applicableCategoryId: { type: String, ref: 'MenuCategory' },
  isActive: { type: Boolean, default: true },
  startDate: { type: String },
  endDate: { type: String }
}, { timestamps: true });

export const DiscountRule = model<IDiscountRule>('DiscountRule', DiscountRuleSchema);
