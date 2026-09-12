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
    const openingBalance = Number(data.openingBalance || 0);
    const currentBalance = data.currentBalance !== undefined ? Number(data.currentBalance) : openingBalance;
    const acc = await ChartOfAccount.create({
      ...data,
      id,
      openingBalance,
      currentBalance
    });
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

  static async updateAccountHead(id: string, data: any, userId?: string, username?: string) {
    const acc = await ChartOfAccount.findOne({ id });
    if (!acc) throw { statusCode: 404, message: 'Account head not found.' };

    const oldValue = acc.toObject();
    if (data.accountName !== undefined) acc.accountName = data.accountName;
    if (data.subType !== undefined) acc.subType = data.subType;
    if (data.description !== undefined) acc.description = data.description;
    if (data.isActive !== undefined) acc.isActive = data.isActive;
    if (data.openingBalance !== undefined) acc.openingBalance = Number(data.openingBalance || 0);

    await acc.save();

    await createAuditLog({
      userId,
      username,
      module: 'Accounts',
      submodule: 'ChartOfAccounts',
      action: 'UPDATE_ACCOUNT',
      recordId: id,
      oldValue,
      newValue: acc
    });

    return acc;
  }

  // Journal Entries
  static async getJournalEntries(query: any = {}) {
    const filter: any = {};
    if (query.referenceType) filter.referenceType = query.referenceType;
    if (query.startDate && query.endDate) {
      filter.entryDate = { $gte: query.startDate, $lte: query.endDate };
    } else if (query.startDate) {
      filter.entryDate = { $gte: query.startDate };
    } else if (query.endDate) {
      filter.entryDate = { $lte: query.endDate };
    }
    if (query.search) {
      filter.$or = [
        { entryNumber: { $regex: query.search, $options: 'i' } },
        { narration: { $regex: query.search, $options: 'i' } },
        { referenceId: { $regex: query.search, $options: 'i' } },
        { 'items.accountName': { $regex: query.search, $options: 'i' } }
      ];
    }
    return JournalEntry.find(filter).sort({ entryDate: -1, createdAt: -1 });
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

  // Individual Account Ledger Statement
  static async getAccountLedger(accountId: string, startDate?: string, endDate?: string) {
    const account = await ChartOfAccount.findOne({ id: accountId });
    if (!account) {
      throw { statusCode: 404, message: 'Account head not found.' };
    }

    const isDebitNormal = account.accountType === 'ASSET' || account.accountType === 'EXPENSE';

    // 1. Calculate opening balance:
    // Base initial opening balance + net sum of entries prior to startDate
    let openingBalance = Number(account.openingBalance || 0);

    if (startDate) {
      const priorEntries = await JournalEntry.find({
        'items.accountId': accountId,
        status: { $ne: 'REJECTED' },
        entryDate: { $lt: startDate }
      }).sort({ entryDate: 1, createdAt: 1 });

      for (const entry of priorEntries) {
        const item = entry.items.find(it => it.accountId === accountId);
        if (item) {
          const debit = Number(item.debit || 0);
          const credit = Number(item.credit || 0);
          const delta = isDebitNormal ? (debit - credit) : (credit - debit);
          openingBalance += delta;
        }
      }
    }

    // 2. Fetch ledger entries in period
    const periodFilter: any = {
      'items.accountId': accountId,
      status: { $ne: 'REJECTED' }
    };

    if (startDate && endDate) {
      periodFilter.entryDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      periodFilter.entryDate = { $gte: startDate };
    } else if (endDate) {
      periodFilter.entryDate = { $lte: endDate };
    }

    const periodEntries = await JournalEntry.find(periodFilter).sort({ entryDate: 1, createdAt: 1 });

    let runningBal = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions = periodEntries.map(entry => {
      const item = entry.items.find(it => it.accountId === accountId)!;
      const otherItems = entry.items.filter(it => it.accountId !== accountId);

      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);
      totalDebit += debit;
      totalCredit += credit;

      const delta = isDebitNormal ? (debit - credit) : (credit - debit);
      runningBal += delta;

      // Construct particulars (opposing account names)
      let particulars = '';
      if (otherItems.length > 0) {
        particulars = otherItems.map(o => {
          const prefix = isDebitNormal
            ? (debit > 0 ? 'To ' : 'By ')
            : (credit > 0 ? 'By ' : 'To ');
          return `${prefix}${o.accountName}`;
        }).join(', ');
      } else {
        particulars = entry.narration || 'Adjustment Entry';
      }

      const balanceType = isDebitNormal
        ? (runningBal >= 0 ? 'Dr' : 'Cr')
        : (runningBal >= 0 ? 'Cr' : 'Dr');

      return {
        id: `${entry.id}_${item.id || uuidv4()}`,
        entryId: entry.id,
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        referenceType: entry.referenceType || 'MANUAL',
        referenceId: entry.referenceId || '',
        narration: entry.narration,
        particulars,
        debit,
        credit,
        runningBalance: Math.abs(runningBal),
        balanceType
      };
    });

    const netChange = isDebitNormal ? (totalDebit - totalCredit) : (totalCredit - totalDebit);
    const openingBalanceType = isDebitNormal
      ? (openingBalance >= 0 ? 'Dr' : 'Cr')
      : (openingBalance >= 0 ? 'Cr' : 'Dr');
    const closingBalanceType = isDebitNormal
      ? (runningBal >= 0 ? 'Dr' : 'Cr')
      : (runningBal >= 0 ? 'Cr' : 'Dr');

    return {
      account,
      period: {
        startDate: startDate || '',
        endDate: endDate || ''
      },
      openingBalance: Math.abs(openingBalance),
      openingBalanceType,
      totalDebit,
      totalCredit,
      netChange,
      closingBalance: Math.abs(runningBal),
      closingBalanceType,
      transactions
    };
  }

  // Trial Balance Report
  static async getTrialBalance(asOfDate?: string) {
    const accounts = await ChartOfAccount.find({ isActive: true }).sort({ accountCode: 1 });
    const targetDate = asOfDate || new Date().toISOString().split('T')[0];

    const filter: any = {
      status: { $ne: 'REJECTED' },
      entryDate: { $lte: targetDate }
    };

    const entries = await JournalEntry.find(filter);

    const debitSums = new Map<string, number>();
    const creditSums = new Map<string, number>();

    for (const entry of entries) {
      for (const item of entry.items) {
        debitSums.set(item.accountId, (debitSums.get(item.accountId) || 0) + Number(item.debit || 0));
        creditSums.set(item.accountId, (creditSums.get(item.accountId) || 0) + Number(item.credit || 0));
      }
    }

    let grandDebit = 0;
    let grandCredit = 0;

    const rows = accounts.map(acc => {
      const isDebitNormal = acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE';
      const initialDr = isDebitNormal ? Number(acc.openingBalance || 0) : 0;
      const initialCr = !isDebitNormal ? Number(acc.openingBalance || 0) : 0;

      const totalDr = (debitSums.get(acc.id) || 0) + initialDr;
      const totalCr = (creditSums.get(acc.id) || 0) + initialCr;

      const net = totalDr - totalCr;
      const debitBalance = net > 0 ? net : 0;
      const creditBalance = net < 0 ? Math.abs(net) : 0;

      grandDebit += debitBalance;
      grandCredit += creditBalance;

      return {
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        subType: acc.subType,
        totalDebit: totalDr,
        totalCredit: totalCr,
        debitBalance,
        creditBalance
      };
    });

    const isBalanced = Math.abs(grandDebit - grandCredit) < 0.05;

    return {
      asOfDate: targetDate,
      grandDebit,
      grandCredit,
      isBalanced,
      rows
    };
  }
}
