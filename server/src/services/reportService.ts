import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { Bill } from '../models/Billing';
import { InventoryItem, StockTransaction } from '../models/Inventory';
import { ChartOfAccount, Expense, DayClosing } from '../models/Account';
import { v4 as uuidv4 } from 'uuid';

export class ReportService {
  // 1. Sales & Orders Report (Includes 1-to-1 Item Process breakdown)
  static async getSalesReport(startDate?: string, endDate?: string) {
    const filter: any = { status: { $in: ['BILLED', 'COMPLETED'] } };
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(`${startDate}T00:00:00.000Z`),
        $lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalGrossSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalTax = orders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const totalDiscount = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const totalNetSales = orders.reduce((sum, o) => sum + (o.netAmount || 0), 0);

    // 1-to-1 Item Sales Process / Granular Dish Sales Breakdown
    const itemMap = new Map<
      string,
      {
        itemName: string;
        quantity: number;
        unitPrice: number;
        totalRevenue: number;
        orderCount: number;
      }
    >();

    orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = it.itemName.toLowerCase().trim();
        const existing = itemMap.get(key) || {
          itemName: it.itemName,
          quantity: 0,
          unitPrice: it.unitPrice || 0,
          totalRevenue: 0,
          orderCount: 0
        };
        existing.quantity += it.quantity || 1;
        existing.totalRevenue += it.totalPrice || (it.quantity || 1) * (it.unitPrice || 0);
        existing.orderCount += 1;
        existing.unitPrice = it.unitPrice || existing.unitPrice;
        itemMap.set(key, existing);
      });
    });

    const itemBreakdown = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);

    return {
      summary: { totalOrders, totalGrossSales, totalTax, totalDiscount, totalNetSales },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString().split('T')[0],
        time: o.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orderType: o.orderType,
        table: o.tableNumber || 'Takeaway',
        customer: o.customerName || 'Walk-in',
        itemsCount: o.items.length,
        subtotal: o.totalAmount,
        tax: o.taxAmount,
        discount: o.discountAmount || 0,
        netTotal: o.netAmount
      })),
      itemBreakdown
    };
  }

  // 2. Tax Invoices & Billing Report
  static async getBillingReport(startDate?: string, endDate?: string) {
    const filter: any = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(`${startDate}T00:00:00.000Z`),
        $lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const bills = await Bill.find(filter).sort({ createdAt: -1 });

    const totalInvoices = bills.length;
    const totalSubtotal = bills.reduce((s, b) => s + (b.subtotal || 0), 0);
    const totalTax = bills.reduce((s, b) => s + (b.taxAmount || 0), 0);
    const totalServiceCharge = bills.reduce((s, b) => s + (b.serviceCharge || 0), 0);
    const totalPayable = bills.reduce((s, b) => s + (b.totalPayable || 0), 0);
    const totalPaid = bills
      .filter((b) => b.status === 'PAID')
      .reduce((s, b) => s + (b.totalPayable || 0), 0);
    const totalUnpaid = bills
      .filter((b) => b.status !== 'PAID')
      .reduce((s, b) => s + (b.balanceAmount || b.totalPayable || 0), 0);

    return {
      summary: {
        totalInvoices,
        totalSubtotal,
        totalTax,
        totalServiceCharge,
        totalPayable,
        totalPaid,
        totalUnpaid
      },
      bills: bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        date: b.createdAt.toISOString().split('T')[0],
        time: b.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        table: b.tableNumber || 'Takeaway',
        customer: b.customerName || 'Walk-in',
        subtotal: b.subtotal,
        tax: b.taxAmount,
        cgst: Number((b.taxAmount / 2).toFixed(2)),
        sgst: Number((b.taxAmount / 2).toFixed(2)),
        serviceCharge: b.serviceCharge || 0,
        roundOff: b.roundOff || 0,
        totalPayable: b.totalPayable,
        paidAmount: b.paidAmount || 0,
        balanceAmount: b.balanceAmount || 0,
        status: b.status
      }))
    };
  }

  // 3. Payment Settlement & Collections Report
  static async getPaymentReport(startDate?: string, endDate?: string) {
    const filter: any = { status: 'COMPLETED' };
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(`${startDate}T00:00:00.000Z`),
        $lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    const methodTotals: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0, ONLINE: 0 };
    let totalCollected = 0;

    payments.forEach((p) => {
      totalCollected += p.amount;
      if (p.paymentMethod === 'SPLIT' && p.transactions) {
        p.transactions.forEach((t) => {
          methodTotals[t.method] = (methodTotals[t.method] || 0) + t.amount;
        });
      } else {
        methodTotals[p.paymentMethod] = (methodTotals[p.paymentMethod] || 0) + p.amount;
      }
    });

    return {
      totalCollected,
      methodTotals,
      payments: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        date: p.createdAt.toISOString().split('T')[0],
        time: p.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        method: p.paymentMethod,
        amount: p.amount,
        reference: p.referenceNumber || 'N/A',
        status: p.status || 'COMPLETED'
      }))
    };
  }

  // 4. Inventory Stock Valuation & Safety Audit Report
  static async getInventoryReport() {
    const [items, transactions] = await Promise.all([
      InventoryItem.find(),
      StockTransaction.find().sort({ createdAt: -1 }).limit(100)
    ]);

    const totalStockValue = items.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0);
    const lowStockCount = items.filter((i) => i.currentStock <= i.minimumStockLevel).length;

    return {
      totalItems: items.length,
      totalStockValue: Math.round(totalStockValue),
      lowStockCount,
      items: items.map((i) => ({
        id: i.id,
        code: i.itemCode,
        name: i.name,
        category: i.category,
        currentStock: i.currentStock,
        unit: i.unitSymbol || 'units',
        minStock: i.minimumStockLevel,
        unitCost: i.costPerUnit,
        valuation: Math.round(i.currentStock * i.costPerUnit),
        isLow: i.currentStock <= i.minimumStockLevel
      })),
      recentTransactions: transactions
    };
  }

  // 5. Operating Expenses & Overheads Report
  static async getExpenseReport(startDate?: string, endDate?: string) {
    const filter: any = {};
    if (startDate && endDate) {
      filter.expenseDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const expenses = await Expense.find(filter).sort({ expenseDate: -1 });
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    return {
      totalExpenses,
      categoryTotals,
      expenses: expenses.map((e) => ({
        id: e.id,
        expenseNumber: e.expenseNumber,
        date: e.expenseDate,
        title: e.title,
        category: e.category,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        status: e.status,
        notes: e.notes || '-'
      }))
    };
  }

  // 6. Financial P&L Statement Report
  static async getFinancialReport() {
    const [accounts, dayClosings, expenses] = await Promise.all([
      ChartOfAccount.find({ isActive: true }),
      DayClosing.find().sort({ closingDate: -1 }).limit(30),
      Expense.find({ status: 'APPROVED' })
    ]);

    const revenue = accounts
      .filter((a) => a.accountType === 'REVENUE')
      .reduce((s, a) => s + a.currentBalance, 0);
    const cogs = accounts
      .filter((a) => a.accountType === 'EXPENSE' && a.subType === 'DIRECT_EXPENSE')
      .reduce((s, a) => s + a.currentBalance, 0);
    const opex = accounts
      .filter((a) => a.accountType === 'EXPENSE' && a.subType !== 'DIRECT_EXPENSE')
      .reduce((s, a) => s + a.currentBalance, 0);

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      operatingExpenses: opex,
      netIncome: revenue - cogs - opex,
      dayClosings,
      expensesSummary: expenses
    };
  }

  // 7. Bulk Data Import (CSV rows importer for Inventory & Expenses)
  static async importData(type: string, rows: any[], userId?: string) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw { statusCode: 400, message: 'No valid data rows provided for import.' };
    }

    if (type === 'inventory') {
      const operations = rows.map((r, idx) => ({
        updateOne: {
          filter: { itemCode: r.itemCode || r.code || `ITEM-${idx + 1}` },
          update: {
            $set: {
              id: r.id || `inv_${uuidv4().slice(0, 8)}`,
              itemCode: r.itemCode || r.code || `ITEM-${idx + 1}`,
              name: r.name || r.itemName,
              category: r.category || 'GENERAL',
              currentStock: Number(r.currentStock || r.stock || 0),
              unitSymbol: r.unit || r.unitSymbol || 'kg',
              minimumStockLevel: Number(r.minStock || r.minimumStockLevel || 5),
              costPerUnit: Number(r.unitCost || r.costPerUnit || 0)
            }
          },
          upsert: true
        }
      }));
      await InventoryItem.bulkWrite(operations as any);
      return { importedCount: rows.length, type: 'inventory' };
    }

    if (type === 'expenses') {
      const created = [];
      for (const r of rows) {
        const exp = await Expense.create({
          id: `exp_${uuidv4().slice(0, 8)}`,
          expenseNumber: r.expenseNumber || `EXP-${Date.now().toString().slice(-4)}`,
          title: r.title || r.description || 'Imported Expense',
          category: r.category || 'MISC',
          amount: Number(r.amount || 0),
          paymentMethod: r.paymentMethod || 'CASH',
          expenseDate: r.date || new Date().toISOString().split('T')[0],
          status: 'APPROVED',
          createdBy: userId
        });
        created.push(exp);
      }
      return { importedCount: created.length, type: 'expenses' };
    }

    throw { statusCode: 400, message: `Unsupported import type: ${type}` };
  }
}
