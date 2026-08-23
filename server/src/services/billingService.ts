import { Bill, IBillItem } from '../models/Billing';
import { Order } from '../models/Order';
import { DiscountRule } from '../models/Discount';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class BillingService {
  static async getBills(query: any = {}) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { billNumber: { $regex: query.search, $options: 'i' } },
        { customerName: { $regex: query.search, $options: 'i' } }
      ];
    }
    return Bill.find(filter).sort({ createdAt: -1 });
  }

  static async getBillById(id: string) {
    const bill = await Bill.findOne({ id });
    if (!bill) throw { statusCode: 404, message: 'Bill not found.' };
    return bill;
  }

  static async generateBillFromOrder(orderId: string, options: any = {}, userId?: string, username?: string) {
    const order = await Order.findOne({ id: orderId });
    if (!order) throw { statusCode: 404, message: 'Order not found.' };

    const count = await Bill.countDocuments();
    const billNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const id = `bill_${uuidv4().slice(0, 8)}`;

    const items: IBillItem[] = order.items.map(it => ({
      id: uuidv4(),
      itemName: it.itemName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      taxRate: 5.0,
      taxAmount: it.taxAmount
    }));

    const subtotal = order.totalAmount;
    let discountAmount = options.discountAmount || order.discountAmount || 0;
    const taxAmount = order.taxAmount;
    const serviceCharge = options.serviceCharge || Math.round(subtotal * 0.05); // 5% service charge
    const rawTotal = subtotal + taxAmount + serviceCharge - discountAmount;
    const totalPayable = Math.round(rawTotal);
    const roundOff = Number((totalPayable - rawTotal).toFixed(2));

    const bill = await Bill.create({
      id,
      billNumber,
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      items,
      subtotal,
      discountRuleId: options.discountRuleId,
      discountAmount,
      discountApprovedBy: options.discountApprovedBy,
      taxAmount,
      serviceCharge,
      roundOff,
      totalPayable,
      paidAmount: 0,
      balanceAmount: totalPayable,
      status: 'UNPAID',
      createdBy: userId
    });

    order.status = 'BILLED';
    await order.save();
    SocketEvents.emitOrderUpdated(order);

    await createAuditLog({
      userId,
      username,
      module: 'Billing',
      submodule: 'Invoices',
      action: 'GENERATE_BILL',
      recordId: id,
      newValue: bill
    });

    return bill;
  }

  static async applyDiscount(billId: string, ruleCode: string, approvedBy?: string, userId?: string, username?: string) {
    const bill = await Bill.findOne({ id: billId });
    if (!bill) throw { statusCode: 404, message: 'Bill not found.' };

    const rule = await DiscountRule.findOne({ code: ruleCode, isActive: true });
    if (!rule) throw { statusCode: 400, message: 'Invalid or inactive discount code.' };

    if (bill.subtotal < rule.minOrderAmount) {
      throw { statusCode: 400, message: `Minimum order amount of ₹${rule.minOrderAmount} required for this discount.` };
    }

    let discountAmount = 0;
    if (rule.type === 'PERCENTAGE') {
      discountAmount = (bill.subtotal * rule.value) / 100;
      if (rule.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, rule.maxDiscountAmount);
      }
    } else {
      discountAmount = Math.min(rule.value, bill.subtotal);
    }

    if (rule.requiresApproval && !approvedBy) {
      throw { statusCode: 403, message: 'This discount rule requires manager approval before application.' };
    }

    bill.discountRuleId = rule.id;
    bill.discountAmount = discountAmount;
    bill.discountApprovedBy = approvedBy;
    
    const rawTotal = bill.subtotal + bill.taxAmount + bill.serviceCharge - discountAmount;
    bill.totalPayable = Math.round(rawTotal);
    bill.roundOff = Number((bill.totalPayable - rawTotal).toFixed(2));
    bill.balanceAmount = bill.totalPayable - bill.paidAmount;

    await bill.save();

    await createAuditLog({
      userId,
      username,
      module: 'Discount',
      submodule: 'Execution',
      action: 'APPLY_DISCOUNT',
      recordId: billId,
      newValue: { discountCode: rule.code, discountAmount }
    });

    return bill;
  }

  static async splitBill(billId: string, splitCount: number) {
    const originalBill = await Bill.findOne({ id: billId });
    if (!originalBill || originalBill.status === 'PAID') {
      throw { statusCode: 400, message: 'Cannot split an already settled or invalid bill.' };
    }

    const splitAmount = Math.floor(originalBill.totalPayable / splitCount);
    const subBills = [];

    for (let i = 1; i <= splitCount; i++) {
      const isLast = i === splitCount;
      const amount = isLast ? originalBill.totalPayable - splitAmount * (splitCount - 1) : splitAmount;
      const subId = `bill_${uuidv4().slice(0, 8)}`;
      const subBillNumber = `${originalBill.billNumber}-S${i}`;

      const subBill = await Bill.create({
        id: subId,
        billNumber: subBillNumber,
        orderId: originalBill.orderId,
        customerId: originalBill.customerId,
        customerName: `${originalBill.customerName || 'Guest'} (Split ${i}/${splitCount})`,
        items: originalBill.items,
        subtotal: Math.round(originalBill.subtotal / splitCount),
        discountAmount: Math.round(originalBill.discountAmount / splitCount),
        taxAmount: Math.round(originalBill.taxAmount / splitCount),
        serviceCharge: Math.round(originalBill.serviceCharge / splitCount),
        roundOff: 0,
        totalPayable: amount,
        paidAmount: 0,
        balanceAmount: amount,
        status: 'UNPAID'
      });
      subBills.push(subBill);
    }

    originalBill.status = 'CANCELLED';
    await originalBill.save();

    return subBills;
  }
}
