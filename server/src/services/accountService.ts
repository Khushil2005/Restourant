import { ChartOfAccount, JournalEntry, DayClosing, IJournalItem } from '../models/Account';
import { Payment } from '../models/Payment';
import { Expense } from '../models/Account';
import { Order } from '../models/Order';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class AccountService {
  // Chart of Accounts
  static async getChartOfAccounts() {
    return ChartOfAccount.find().sort({ accountCode: 1 });
  }

  static async createAccountHead(data: any, userId?: string, username?: string) {
    const id = `acc_${uuidv4().slice(0, 8)}`;
    const acc = await ChartOfAccount.create({ ...data, id });
    await createAuditLog({
      userId,
      username,
      module: 'Accounts',
      submodule: 'ChartOfAccounts',
      action: 'CREATE_ACCOUNT',
      recordId: id,
      newValue: acc
    });
    return acc;
  }

  // Journal Entries
  static async getJournalEntries(query: any = {}) {
    const filter: any = {};
    if (query.referenceType) filter.referenceType = query.referenceType;
    return JournalEntry.find(filter).sort({ createdAt: -1 });
  }

  static async createJournalEntry(data: any, userId?: string, username?: string) {
    // Validate balanced double-entry (Debit must equal Credit)
    let totalDebit = 0;
    let totalCredit = 0;

    const items: IJournalItem[] = data.items.map((it: any) => {
      const debit = Number(it.debit || 0);
      const credit = Number(it.credit || 0);
      totalDebit += debit;
      totalCredit += credit;
      return {
        id: uuidv4(),
        accountId: it.accountId,
        accountName: it.accountName,
        debit,
        credit,
        description: it.description
      };
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw { statusCode: 400, message: `Double-entry unbalanced: Total Debit (₹${totalDebit}) must equal Total Credit (₹${totalCredit}).` };
    }

    const count = await JournalEntry.countDocuments();
    const entryNumber = `JRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const id = `jrn_${uuidv4().slice(0, 8)}`;

    const entry = await JournalEntry.create({
      id,
      entryNumber,
      entryDate: data.entryDate || new Date().toISOString().split('T')[0],
      referenceType: data.referenceType || 'MANUAL',
      referenceId: data.referenceId,
      narration: data.narration,
      items,
      totalDebit,
      totalCredit,
      status: 'POSTED',
      createdBy: userId
    });

    // Update account balances
    for (const it of items) {
      const acc = await ChartOfAccount.findOne({ id: it.accountId });
      if (acc) {
        // Normal balances: Assets & Expenses increase with Debit; Liabilities, Equity, Revenue increase with Credit
        if (acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE') {
          acc.currentBalance += (it.debit - it.credit);
        } else {
          acc.currentBalance += (it.credit - it.debit);
        }
        await acc.save();
      }
    }

    await createAuditLog({
      userId,
      username,
      module: 'Accounts',
      submodule: 'Journal',
      action: 'CREATE_JOURNAL_VOUCHER',
      recordId: id,
      newValue: entry
    });

    return entry;
  }

  // Day Closing Register
  static async getDayClosings() {
    return DayClosing.find().sort({ closingDate: -1 });
  }

  static async executeDayClosing(data: any, userId?: string, username?: string) {
    const today = data.closingDate || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const endOfDay = new Date(`${today}T23:59:59.999Z`);

    const existing = await DayClosing.findOne({ closingDate: today });
    if (existing && existing.status === 'CLOSED') {
      throw { statusCode: 400, message: 'Day closing has already been executed for this date.' };
    }

    const [payments, expenses, orders] = await Promise.all([
      Payment.find({ createdAt: { $gte: startOfDay, $lte: endOfDay }, status: 'COMPLETED' }),
      Expense.find({ expenseDate: today, status: 'APPROVED' }),
      Order.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } })
    ]);

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let otherSales = 0;

    payments.forEach(p => {
      if (p.paymentMethod === 'CASH') cashSales += p.amount;
      else if (p.paymentMethod === 'UPI') upiSales += p.amount;
      else if (p.paymentMethod === 'CARD') cardSales += p.amount;
      else otherSales += p.amount;
    });

    const totalSales = cashSales + upiSales + cardSales + otherSales;
    const cashExpenses = expenses.filter(e => e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const openingCash = data.openingCash || 25000;
    const expectedCash = openingCash + cashSales - cashExpenses;
    const actualCash = data.actualCash !== undefined ? Number(data.actualCash) : expectedCash;
    const cashDifference = actualCash - expectedCash;

    const id = `dc_${uuidv4().slice(0, 8)}`;
    const closing = await DayClosing.findOneAndUpdate(
      { closingDate: today },
      {
        $set: {
          id: existing ? existing.id : id,
          closingDate: today,
          openingCash,
          totalSales,
          cashSales,
          upiSales,
          cardSales,
          otherSales,
          totalExpenses,
          cashExpenses,
          expectedCash,
          actualCash,
          cashDifference,
          totalOrders: orders.length,
          status: 'CLOSED',
          closedBy: userId,
          notes: data.notes
        }
      },
      { upsert: true, new: true }
    );

    await createAuditLog({
      userId,
      username,
      module: 'Accounts',
      submodule: 'DayClosing',
      action: 'EXECUTE_DAY_CLOSING',
      recordId: closing.id,
      newValue: closing
    });

    return closing;
  }

  // Financial Statements
  static async getFinancialSummary() {
    const accounts = await ChartOfAccount.find({ isActive: true });
    
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalOperatingExpense = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    accounts.forEach(a => {
      if (a.accountType === 'REVENUE') totalRevenue += a.currentBalance;
      else if (a.accountType === 'EXPENSE' && a.subType === 'DIRECT_EXPENSE') totalCOGS += a.currentBalance;
      else if (a.accountType === 'EXPENSE') totalOperatingExpense += a.currentBalance;
      else if (a.accountType === 'ASSET') totalAssets += a.currentBalance;
      else if (a.accountType === 'LIABILITY') totalLiabilities += a.currentBalance;
      else if (a.accountType === 'EQUITY') totalEquity += a.currentBalance;
    });

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalOperatingExpense;

    return {
      profitAndLoss: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalOperatingExpense,
        netProfit,
        profitMarginPercentage: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0
      },
      balanceSheet: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netProfit)) < 100
      },
      accounts
    };
  }
}
