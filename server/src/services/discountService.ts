import { DiscountRule } from '../models/Discount';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class DiscountService {
  static async getDiscountRules() {
    return DiscountRule.find().sort({ createdAt: -1 });
  }

  static async createDiscountRule(data: any, userId?: string, username?: string) {
    const id = `disc_${uuidv4().slice(0, 8)}`;
    const type = data.type || data.discountType || 'PERCENTAGE';
    const value = Number(data.value ?? data.discountValue ?? 0);
    const minOrderAmount = Number(data.minOrderAmount ?? 0);
    const maxDiscountAmount = data.maxDiscountAmount !== undefined && data.maxDiscountAmount !== null && data.maxDiscountAmount !== '' ? Number(data.maxDiscountAmount) : undefined;
    const requiresApproval = Boolean(data.requiresApproval ?? (data.requiresApprovalAbove !== undefined && data.requiresApprovalAbove !== null));

    const rule = await DiscountRule.create({
      ...data,
      id,
      code: (data.code || '').toUpperCase(),
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      requiresApproval
    });

    await createAuditLog({
      userId,
      username,
      module: 'Discount',
      submodule: 'Rules',
      action: 'CREATE_RULE',
      recordId: id,
      newValue: rule
    });

    return rule;
  }

  static async updateDiscountRule(id: string, data: any, userId?: string, username?: string) {
    const old = await DiscountRule.findOne({ id });
    const updateData: any = { ...data };
    if (data.code) updateData.code = data.code.toUpperCase();
    if (data.type || data.discountType) updateData.type = data.type || data.discountType;
    if (data.value !== undefined || data.discountValue !== undefined) {
      updateData.value = Number(data.value ?? data.discountValue);
    }
    const updated = await DiscountRule.findOneAndUpdate({ id }, { $set: updateData }, { new: true });
    await createAuditLog({
      userId,
      username,
      module: 'Discount',
      submodule: 'Rules',
      action: 'EDIT_RULE',
      recordId: id,
      oldValue: old,
      newValue: updated
    });
    return updated;
  }

  static async deleteDiscountRule(id: string, userId?: string, username?: string) {
    const old = await DiscountRule.findOne({ id });
    await DiscountRule.deleteOne({ id });
    await createAuditLog({
      userId,
      username,
      module: 'Discount',
      submodule: 'Rules',
      action: 'DELETE_RULE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }
}
