import { Bill, IBillItem } from '../models/Billing';
import { Order } from '../models/Order';
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

    // Strict Rule: Order must be SERVED before generating a bill
    if (order.status !== 'SERVED' && order.status !== 'BILLED') {
      throw {
        statusCode: 400,
        message: `Cannot generate bill: Order #${order.orderNumber || order.id} is currently '${order.status}'. Orders must be SERVED before generating a bill (ઓર્ડર સર્વ થયા પછી જ બિલ જનરેટ કરી શકાય છે).`
      };
    }

    // Prevent duplicate bill generation for the same order or table
    let existingBill = await Bill.findOne({
      orderId: order.id,
      status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] }
    });

    if (!existingBill && order.tableId) {
      existingBill = await Bill.findOne({
        tableId: order.tableId,
        status: { $in: ['UNPAID', 'PARTIALLY_PAID'] }
      });
    }

    if (existingBill) {
      // If existing bill is UNPAID, sync items and calculations in case order was updated
      if (existingBill.status === 'UNPAID') {
        const items: IBillItem[] = order.items.map(it => ({
          id: uuidv4(),
          itemName: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          taxRate: 5.0,
          taxAmount: it.taxAmount
        }));
        existingBill.items = items;
        existingBill.subtotal = order.totalAmount;
        existingBill.taxAmount = order.taxAmount;
        if (order.tableNumber && !existingBill.tableNumber) existingBill.tableNumber = order.tableNumber;
        if (order.tableId && !existingBill.tableId) existingBill.tableId = order.tableId;

        const discountAmount = 0;
        const serviceCharge = options.serviceCharge !== undefined ? options.serviceCharge : (existingBill.serviceCharge || Math.round(existingBill.subtotal * 0.05));
        const rawTotal = existingBill.subtotal + existingBill.taxAmount + serviceCharge - discountAmount;
        existingBill.discountAmount = discountAmount;
        existingBill.serviceCharge = serviceCharge;
        existingBill.totalPayable = Math.round(rawTotal);
        existingBill.roundOff = Number((existingBill.totalPayable - rawTotal).toFixed(2));
        existingBill.balanceAmount = Math.max(0, existingBill.totalPayable - (existingBill.paidAmount || 0));
        await existingBill.save();
        SocketEvents.emitOrderUpdated(order);
        return existingBill;
      }
      return existingBill;
    }

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
    const discountAmount = 0;
    const taxAmount = order.taxAmount;
    const serviceCharge = options.serviceCharge || Math.round(subtotal * 0.05); // 5% service charge
    const rawTotal = subtotal + taxAmount + serviceCharge - discountAmount;
    const totalPayable = Math.round(rawTotal);
    const roundOff = Number((totalPayable - rawTotal).toFixed(2));

    const bill = await Bill.create({
      id,
      billNumber,
      orderId: order.id,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      items,
      subtotal,
      discountAmount: 0,
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
