import { Payment, IPaymentTransaction } from '../models/Payment';
import { Bill } from '../models/Billing';
import { ChartOfAccount, JournalEntry } from '../models/Account';
import { OrderService } from './orderService';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  static async getPayments(query: any = {}) {
    const filter: any = {};
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.status) filter.status = query.status;
    return Payment.find(filter).sort({ createdAt: -1 });
  }

  static async getPaymentById(id: string) {
    const payment = await Payment.findOne({ id });
    if (!payment) throw { statusCode: 404, message: 'Payment record not found.' };
    return payment;
  }

  static async createPayment(data: any, userId?: string, username?: string) {
    const bill = await Bill.findOne({ id: data.billId });
    if (!bill) throw { statusCode: 404, message: 'Bill not found.' };

    if (bill.status === 'PAID') {
      throw { statusCode: 400, message: 'This bill has already been fully paid.' };
    }

    const count = await Payment.countDocuments();
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const id = `pay_${uuidv4().slice(0, 8)}`;

    const transactions: IPaymentTransaction[] = (data.transactions || []).map((tx: any) => ({
      id: uuidv4(),
      method: tx.method,
      amount: tx.amount,
      transactionRef: tx.transactionRef,
      status: 'SUCCESS',
      createdAt: new Date()
    }));

    // If single method
    if (transactions.length === 0 && data.amount) {
      transactions.push({
        id: uuidv4(),
        method: data.paymentMethod,
        amount: data.amount,
        transactionRef: data.referenceNumber,
        status: 'SUCCESS',
        createdAt: new Date()
      });
    }

    const paidThisTime = transactions.reduce((sum, t) => sum + t.amount, 0);
    bill.paidAmount = (bill.paidAmount || 0) + paidThisTime;
    bill.balanceAmount = Math.max(0, bill.totalPayable - bill.paidAmount);

    const isFullyPaid = bill.balanceAmount <= 0;
    bill.status = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';
    await bill.save();

    const payment = await Payment.create({
      id,
      paymentNumber,
      billId: bill.id,
      orderId: bill.orderId,
      amount: paidThisTime,
      paymentMethod: data.paymentMethod || (transactions.length > 1 ? 'SPLIT' : transactions[0].method),
      status: 'COMPLETED',
      transactions,
      referenceNumber: data.referenceNumber,
      verifiedBy: userId,
      isReconciled: false,
      notes: data.notes,
      createdBy: userId
    });

    // 1. Complete Order & trigger recipe deductions if fully paid
    if (isFullyPaid && bill.orderId) {
      await OrderService.completeOrder(bill.orderId, userId, username);
    }

    // 2. AUTOMATIC POSTING TO DOUBLE-ENTRY ACCOUNTS
    try {
      const journalCount = await JournalEntry.countDocuments();
      const entryNumber = `JRN-${new Date().getFullYear()}-${String(journalCount + 1).padStart(4, '0')}`;
      const journalId = `jrn_${uuidv4().slice(0, 8)}`;

      const debitAccountId = (data.paymentMethod === 'CASH' || (transactions[0]?.method === 'CASH'))
        ? 'acc_cash_drawer'
        : 'acc_bank_hdfc';

      const debitAccount = await ChartOfAccount.findOne({ id: debitAccountId });
      const revenueAccount = await ChartOfAccount.findOne({ id: 'acc_food_sales' });
      const taxAccount = await ChartOfAccount.findOne({ id: 'acc_gst_payable' });

      if (debitAccount && revenueAccount && taxAccount) {
        const netRevenue = Math.max(0, paidThisTime - bill.taxAmount);
        const taxShare = Math.min(bill.taxAmount, paidThisTime);

        // Update ledger balances
        debitAccount.currentBalance += paidThisTime;
        revenueAccount.currentBalance += netRevenue;
        taxAccount.currentBalance += taxShare;

        await Promise.all([debitAccount.save(), revenueAccount.save(), taxAccount.save()]);

        await JournalEntry.create({
          id: journalId,
          entryNumber,
          entryDate: new Date().toISOString().split('T')[0],
          referenceType: 'SALES',
          referenceId: paymentNumber,
          narration: `Sales collection for Bill ${bill.billNumber} via ${payment.paymentMethod}`,
          totalDebit: paidThisTime,
          totalCredit: paidThisTime,
          status: 'POSTED',
          createdBy: userId,
          items: [
            {
              id: uuidv4(),
              accountId: debitAccount.id,
              accountName: debitAccount.accountName,
              debit: paidThisTime,
              credit: 0,
              description: `Payment received for ${bill.billNumber}`
            },
            {
              id: uuidv4(),
              accountId: revenueAccount.id,
              accountName: revenueAccount.accountName,
              debit: 0,
              credit: netRevenue,
              description: `Sales revenue for ${bill.billNumber}`
            },
            {
              id: uuidv4(),
              accountId: taxAccount.id,
              accountName: taxAccount.accountName,
              debit: 0,
              credit: taxShare,
              description: `GST collected on ${bill.billNumber}`
            }
          ]
        });
      }
    } catch (accErr) {
      console.error('[Accounting Auto Journal Posting Error]:', accErr);
    }

    SocketEvents.emitPaymentCompleted(payment);

    await createAuditLog({
      userId,
      username,
      module: 'Payment',
      submodule: 'Settlements',
      action: 'PROCESS_PAYMENT',
      recordId: id,
      newValue: payment
    });

    return { payment, bill };
  }

  static async verifyPayment(id: string, userId?: string, username?: string) {
    const payment = await Payment.findOneAndUpdate(
      { id },
      { $set: { verifiedBy: userId } },
      { new: true }
    );
    return payment;
  }

  static async reconcilePayment(id: string, userId?: string, username?: string) {
    const payment = await Payment.findOneAndUpdate(
      { id },
      { $set: { isReconciled: true, reconciledAt: new Date(), reconciledBy: userId } },
      { new: true }
    );
    return payment;
  }

  static async refundPayment(id: string, refundAmount: number, reason: string, userId?: string, username?: string) {
    const payment = await Payment.findOne({ id });
    if (!payment) throw { statusCode: 404, message: 'Payment record not found.' };

    payment.status = 'REFUNDED';
    payment.notes = (payment.notes ? `${payment.notes}; ` : '') + `Refunded ₹${refundAmount}: ${reason}`;
    await payment.save();

    await createAuditLog({
      userId,
      username,
      module: 'Payment',
      submodule: 'Settlements',
      action: 'REFUND_PAYMENT',
      recordId: id,
      newValue: { refundAmount, reason }
    });

    return payment;
  }
}
