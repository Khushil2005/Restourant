import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { InventoryItem, StockTransaction } from '../models/Inventory';
import { PurchaseOrder } from '../models/Purchase';
import { ChartOfAccount, Expense, DayClosing } from '../models/Account';
import { AttendanceRecord, PayrollRun } from '../models/HR';

export class ReportService {
  // Sales Reports
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

    return {
      summary: { totalOrders, totalGrossSales, totalTax, totalDiscount, totalNetSales },
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString().split('T')[0],
        orderType: o.orderType,
        table: o.tableNumber || 'N/A',
        customer: o.customerName || 'Walk-in',
        itemsCount: o.items.length,
        subtotal: o.totalAmount,
        tax: o.taxAmount,
        discount: o.discountAmount,
        netTotal: o.netAmount
      }))
    };
  }

  // Payment Reconciliation Report
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

    payments.forEach(p => {
      totalCollected += p.amount;
      if (p.paymentMethod === 'SPLIT' && p.transactions) {
        p.transactions.forEach(t => {
          methodTotals[t.method] = (methodTotals[t.method] || 0) + t.amount;
        });
      } else {
        methodTotals[p.paymentMethod] = (methodTotals[p.paymentMethod] || 0) + p.amount;
      }
    });

    return {
      totalCollected,
      methodTotals,
      payments: payments.map(p => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        date: p.createdAt.toISOString().split('T')[0],
        method: p.paymentMethod,
        amount: p.amount,
        reference: p.referenceNumber || 'N/A',
        isReconciled: p.isReconciled
      }))
    };
  }

  // Inventory Consumption Report
  static async getInventoryReport() {
    const [items, transactions] = await Promise.all([
      InventoryItem.find(),
      StockTransaction.find().sort({ createdAt: -1 }).limit(100)
    ]);

    const totalStockValue = items.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0);
    const lowStockCount = items.filter(i => i.currentStock <= i.minimumStockLevel).length;

    return {
      totalItems: items.length,
      totalStockValue: Math.round(totalStockValue),
      lowStockCount,
      items: items.map(i => ({
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

  // Financial Statement Report
  static async getFinancialReport() {
    const [accounts, dayClosings, expenses] = await Promise.all([
      ChartOfAccount.find({ isActive: true }),
      DayClosing.find().sort({ closingDate: -1 }).limit(30),
      Expense.find({ status: 'APPROVED' })
    ]);

    const revenue = accounts.filter(a => a.accountType === 'REVENUE').reduce((s, a) => s + a.currentBalance, 0);
    const cogs = accounts.filter(a => a.accountType === 'EXPENSE' && a.subType === 'DIRECT_EXPENSE').reduce((s, a) => s + a.currentBalance, 0);
    const opex = accounts.filter(a => a.accountType === 'EXPENSE' && a.subType !== 'DIRECT_EXPENSE').reduce((s, a) => s + a.currentBalance, 0);

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
}
