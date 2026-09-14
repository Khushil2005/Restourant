import { Expense, ChartOfAccount, JournalEntry } from '../models/Account';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class ExpenseService {
  static async getExpenses(query: any = {}) {
    const filter: any = {};
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    return Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 });
  }

  static async createExpense(data: any, userId?: string, username?: string) {
    const count = await Expense.countDocuments();
    const expenseNumber = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const id = `exp_${uuidv4().slice(0, 8)}`;

    const account = await ChartOfAccount.findOne({ id: data.accountId });

    const expense = await Expense.create({
      id,
      expenseNumber,
      accountId: data.accountId,
      accountName: account?.accountName || data.category,
      title: data.title,
      category: data.category,
      amount: Number(data.amount),
      paymentMethod: data.paymentMethod || 'CASH',
      paymentAccountId: data.paymentMethod === 'CASH' ? 'acc_cash_drawer' : 'acc_bank_hdfc',
      expenseDate: data.expenseDate || new Date().toISOString().split('T')[0],
      receiptUrl: data.receiptUrl,
      status: 'APPROVED',
      approvedBy: userId,
      createdBy: userId,
      notes: data.notes
    });

    // Auto-update Account Balances and Post Journal Entry
    try {
      const expenseAcc = await ChartOfAccount.findOne({ id: data.accountId });
      const isCash = (data.paymentMethod === 'CASH');
      const payAcc = isCash
        ? await ChartOfAccount.findOne({ $or: [{ id: 'acc_cash_drawer' }, { subType: 'CASH' }] })
        : await ChartOfAccount.findOne({ $or: [{ id: 'acc_bank_sbi' }, { id: 'acc_bank_hdfc' }, { subType: 'BANK' }] });

      if (expenseAcc && payAcc) {
        expenseAcc.currentBalance += Number(data.amount);
        payAcc.currentBalance -= Number(data.amount);
        await Promise.all([expenseAcc.save(), payAcc.save()]);

        const jrnCount = await JournalEntry.countDocuments();
        await JournalEntry.create({
          id: `jrn_${uuidv4().slice(0, 8)}`,
          entryNumber: `JRN-${new Date().getFullYear()}-${String(jrnCount + 1).padStart(4, '0')}`,
          entryDate: expense.expenseDate,
          referenceType: 'EXPENSE',
          referenceId: expense.expenseNumber,
          narration: `Expense: ${expense.title} (${expense.category}) paid via ${expense.paymentMethod}`,
          totalDebit: expense.amount,
          totalCredit: expense.amount,
          status: 'POSTED',
          createdBy: userId,
          items: [
            {
              id: uuidv4(),
              accountId: expenseAcc.id,
              accountName: expenseAcc.accountName,
              debit: expense.amount,
              credit: 0,
              description: expense.title
            },
            {
              id: uuidv4(),
              accountId: payAcc.id,
              accountName: payAcc.accountName,
              debit: 0,
              credit: expense.amount,
              description: `Disbursed from ${payAcc.accountName}`
            }
          ]
        });
      }
    } catch (jErr) {
      console.error('[Expense Auto Journal Error]:', jErr);
    }

    await createAuditLog({
      userId,
      username,
      module: 'Expenses',
      submodule: 'Vouchers',
      action: 'CREATE_EXPENSE',
      recordId: id,
      newValue: expense
    });

    return expense;
  }

  static async updateExpenseStatus(id: string, status: string, userId?: string, username?: string) {
    const expense = await Expense.findOneAndUpdate(
      { id },
      { $set: { status, approvedBy: userId } },
      { new: true }
    );
    return expense;
  }

  static async deleteExpense(id: string, userId?: string, username?: string) {
    const old = await Expense.findOne({ id });
    await Expense.deleteOne({ id });
    await createAuditLog({
      userId,
      username,
      module: 'Expenses',
      action: 'DELETE_EXPENSE',
      recordId: id,
      oldValue: old
    });
    return { success: true };
  }
}
