import { DiscountRule } from '../models/Discount';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class DiscountService {
  static async getDiscountRules() {
    return DiscountRule.find().sort({ createdAt: -1 });
  }

  static async createDiscountRule(data: any, userId?: string, username?: string) {
    const id = `disc_${uuidv4().slice(0, 8)}`;
    const rule = await DiscountRule.create({
      ...data,
      id,
      code: data.code.toUpperCase()
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
    const updated = await DiscountRule.findOneAndUpdate({ id }, { $set: data }, { new: true });
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
