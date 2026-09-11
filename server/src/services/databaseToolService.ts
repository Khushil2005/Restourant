import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Bill } from '../models/Billing';
import { Payment } from '../models/Payment';
import { Order } from '../models/Order';
import { KOTTicket } from '../models/KOT';
import { Booking } from '../models/Booking';
import { QueueToken } from '../models/QueueToken';
import {
  Customer,
  Supplier,
  Department,
  Designation,
  Unit,
  TaxMaster,
  MenuCategory,
  MenuItem,
  FloorZone,
  DiningTable
} from '../models/Master';
import {
  PurchaseOrder,
  GoodsReceipt,
  PurchaseInvoice
} from '../models/Purchase';
import {
  ChartOfAccount,
  JournalEntry,
  Expense,
  DayClosing
} from '../models/Account';
import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryStructure,
  PayrollRun,
  Payslip
} from '../models/HR';
import {
  InventoryItem,
  Recipe,
  StockTransaction,
  StockAdjustment,
  StockTransfer
} from '../models/Inventory';
import { DailyMenu, DailyMenuConfig } from '../models/DailyMenu';
import { User, UserSession } from '../models/User';
import { Role, Permission } from '../models/Role';
import {
  AuditLog,
  SystemNotification,
  SystemSetting,
  MaintenanceLog
} from '../models/System';
import { createAuditLog } from '../middleware/auditMiddleware';

export interface CollectionMeta {
  key: string;
  name: string;
  category: 'TRANSACTIONAL' | 'MASTER' | 'SYSTEM';
  dateField?: string;
  searchFields: string[];
  model: Model<any>;
}

export const COLLECTION_REGISTRY: Record<string, CollectionMeta> = {
  // 1. Transactional Collections (Date-Filtered & Purgeable)
  bills: {
    key: 'bills',
    name: 'Bills & Invoices',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['billNumber', 'customerName', 'tableNumber', 'status', 'id'],
    model: Bill
  },
  payments: {
    key: 'payments',
    name: 'Payment Receipts',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['paymentNumber', 'paymentMethod', 'referenceNumber', 'id'],
    model: Payment
  },
  orders: {
    key: 'orders',
    name: 'Orders',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['orderNumber', 'tableNumber', 'customerName', 'status', 'id'],
    model: Order
  },
  kot: {
    key: 'kot',
    name: 'Kitchen Order Tickets (KOT)',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['kotNumber', 'orderId', 'tableNumber', 'status', 'id'],
    model: KOTTicket
  },
  bookings: {
    key: 'bookings',
    name: 'Table Bookings',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['customerName', 'contactPhone', 'bookingDate', 'status', 'id'],
    model: Booking
  },
  tokens: {
    key: 'tokens',
    name: 'Queue Tokens',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['tokenNumber', 'customerName', 'status', 'id'],
    model: QueueToken
  },
  expenses: {
    key: 'expenses',
    name: 'Expense Vouchers',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['voucherNumber', 'title', 'category', 'id'],
    model: Expense
  },
  journal_entries: {
    key: 'journal_entries',
    name: 'Journal Entries & Ledger',
    category: 'TRANSACTIONAL',
    dateField: 'entryDate',
    searchFields: ['entryNumber', 'narration', 'referenceNumber', 'id'],
    model: JournalEntry
  },
  stock_transactions: {
    key: 'stock_transactions',
    name: 'Stock Transactions',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['transactionType', 'referenceType', 'referenceId', 'id'],
    model: StockTransaction
  },
  attendance: {
    key: 'attendance',
    name: 'Staff Attendance',
    category: 'TRANSACTIONAL',
    dateField: 'date',
    searchFields: ['employeeId', 'status', 'id'],
    model: AttendanceRecord
  },
  audit_logs: {
    key: 'audit_logs',
    name: 'System Audit Logs',
    category: 'TRANSACTIONAL',
    dateField: 'timestamp',
    searchFields: ['module', 'action', 'username', 'id'],
    model: AuditLog
  },
  notifications: {
    key: 'notifications',
    name: 'Notifications',
    category: 'TRANSACTIONAL',
    dateField: 'createdAt',
    searchFields: ['title', 'message', 'id'],
    model: SystemNotification
  },

  // 2. Master Data Collections (Protected by default)
  menu_items: {
    key: 'menu_items',
    name: 'Menu Items',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'categoryName', 'code', 'id'],
    model: MenuItem
  },
  menu_categories: {
    key: 'menu_categories',
    name: 'Menu Categories',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'id'],
    model: MenuCategory
  },
  dining_tables: {
    key: 'dining_tables',
    name: 'Dining Tables',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['tableNumber', 'status', 'id'],
    model: DiningTable
  },
  floor_zones: {
    key: 'floor_zones',
    name: 'Floor Zones',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'id'],
    model: FloorZone
  },
  customers: {
    key: 'customers',
    name: 'Customers Directory',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'phone', 'email', 'id'],
    model: Customer
  },
  suppliers: {
    key: 'suppliers',
    name: 'Suppliers Directory',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'phone', 'contactPerson', 'id'],
    model: Supplier
  },
  inventory_items: {
    key: 'inventory_items',
    name: 'Inventory Items',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'sku', 'category', 'id'],
    model: InventoryItem
  },
  recipes: {
    key: 'recipes',
    name: 'Recipes',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['name', 'menuItemId', 'id'],
    model: Recipe
  },
  chart_of_accounts: {
    key: 'chart_of_accounts',
    name: 'Chart of Accounts',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['accountCode', 'accountName', 'accountType', 'id'],
    model: ChartOfAccount
  },
  employees: {
    key: 'employees',
    name: 'Employees Directory',
    category: 'MASTER',
    dateField: 'createdAt',
    searchFields: ['firstName', 'lastName', 'phone', 'employeeCode', 'id'],
    model: Employee
  },
  users: {
    key: 'users',
    name: 'System Users',
    category: 'SYSTEM',
    dateField: 'createdAt',
    searchFields: ['username', 'email', 'displayName', 'id'],
    model: User
  },
  roles: {
    key: 'roles',
    name: 'Roles',
    category: 'SYSTEM',
    dateField: 'createdAt',
    searchFields: ['name', 'id'],
    model: Role
  },
  permissions: {
    key: 'permissions',
    name: 'Permissions',
    category: 'SYSTEM',
    searchFields: ['id', 'name', 'module', 'action'],
    model: Permission
  },
  system_settings: {
    key: 'system_settings',
    name: 'System Settings',
    category: 'SYSTEM',
    dateField: 'updatedAt',
    searchFields: ['key', 'value', 'category', 'id'],
    model: SystemSetting
  }
};

const buildDateQuery = (dateField: string, startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return null;
  const filter: any = {};
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    filter.$gte = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    filter.$lte = e;
  }
  return { [dateField]: filter };
};

export class DatabaseToolService {
  /**
   * 1. Get metadata and live record counts for all registered collections
   */
  static async getCollectionList() {
    const entries = Object.values(COLLECTION_REGISTRY);
    const results = await Promise.all(
      entries.map(async (c) => {
        let count = 0;
        try {
          count = await c.model.countDocuments();
        } catch (_) {}
        return {
          key: c.key,
          name: c.name,
          category: c.category,
          dateField: c.dateField,
          count
        };
      })
    );
    return results;
  }

  /**
   * 2. Query paginated records with optional search & date range
   */
  static async queryCollection(
    key: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const meta = COLLECTION_REGISTRY[key];
    if (!meta) throw new Error(`Collection '${key}' is not recognized in registry.`);

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const queryConditions: any[] = [];

    // Date filtering if field supported
    if (meta.dateField && (options.startDate || options.endDate)) {
      const dateQ = buildDateQuery(meta.dateField, options.startDate, options.endDate);
      if (dateQ) queryConditions.push(dateQ);
    }

    // Text searching across defined fields
    if (options.search && options.search.trim()) {
      const s = options.search.trim();
      const searchOr = meta.searchFields.map((field) => ({
        [field]: { $regex: s, $options: 'i' }
      }));
      queryConditions.push({ $or: searchOr });
    }

    const finalQuery = queryConditions.length > 0 ? { $and: queryConditions } : {};

    const sortField = meta.dateField || '_id';
    const [records, total] = await Promise.all([
      meta.model.find(finalQuery).sort({ [sortField]: -1 }).skip(skip).limit(limit).lean(),
      meta.model.countDocuments(finalQuery)
    ]);

    return {
      key: meta.key,
      name: meta.name,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      records
    };
  }

  /**
   * 3. Insert record directly into collection
   */
  static async createRecord(key: string, data: any, user?: { userId?: string; username?: string }) {
    const meta = COLLECTION_REGISTRY[key];
    if (!meta) throw new Error(`Collection '${key}' is not recognized.`);

    if (!data.id) {
      data.id = randomUUID();
    }
    if (meta.dateField && !data[meta.dateField]) {
      data[meta.dateField] = new Date();
    }

    const created = await meta.model.create(data);

    await createAuditLog({
      userId: user?.userId,
      username: user?.username,
      module: 'Database Tools',
      action: 'DIRECT_RECORD_CREATE',
      newValue: { collection: key, recordId: created.id || created._id }
    });

    return created;
  }

  /**
   * 4. Update record directly in collection
   */
  static async updateRecord(key: string, id: string, data: any, user?: { userId?: string; username?: string }) {
    const meta = COLLECTION_REGISTRY[key];
    if (!meta) throw new Error(`Collection '${key}' is not recognized.`);

    delete data._id; // Never mutate MongoDB _id

    const updated = await meta.model.findOneAndUpdate(
      { $or: [{ id }, { _id: id }] },
      { $set: data },
      { new: true }
    );
    if (!updated) throw new Error(`Record with ID '${id}' not found in '${key}'.`);

    await createAuditLog({
      userId: user?.userId,
      username: user?.username,
      module: 'Database Tools',
      action: 'DIRECT_RECORD_UPDATE',
      newValue: { collection: key, recordId: id, updatedFields: Object.keys(data) }
    });

    return updated;
  }

  /**
   * 5. Delete record directly from collection
   */
  static async deleteRecord(key: string, id: string, user?: { userId?: string; username?: string }) {
    const meta = COLLECTION_REGISTRY[key];
    if (!meta) throw new Error(`Collection '${key}' is not recognized.`);

    const deleted = await meta.model.findOneAndDelete({ $or: [{ id }, { _id: id }] });
    if (!deleted) throw new Error(`Record with ID '${id}' not found in '${key}'.`);

    await createAuditLog({
      userId: user?.userId,
      username: user?.username,
      module: 'Database Tools',
      action: 'DIRECT_RECORD_DELETE',
      oldValue: { collection: key, recordId: id }
    });

    return deleted;
  }

  /**
   * 6. Export filtered data across selected collections for a date range
   */
  static async exportData(options: {
    collections?: string[];
    startDate?: string;
    endDate?: string;
  }) {
    const selectedKeys = options.collections && options.collections.length > 0
      ? options.collections
      : Object.keys(COLLECTION_REGISTRY);

    const exportPayload: Record<string, any[]> = {};
    const counts: Record<string, number> = {};

    for (const key of selectedKeys) {
      const meta = COLLECTION_REGISTRY[key];
      if (!meta) continue;

      let query: any = {};
      if (meta.dateField && (options.startDate || options.endDate)) {
        const dateQ = buildDateQuery(meta.dateField, options.startDate, options.endDate);
        if (dateQ) query = dateQ;
      }

      const docs = await meta.model.find(query).lean();
      exportPayload[key] = docs;
      counts[key] = docs.length;
    }

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        startDate: options.startDate || 'ALL',
        endDate: options.endDate || 'ALL',
        appName: 'Restaurant ERP System'
      },
      counts,
      data: exportPayload
    };
  }

  /**
   * 7. Import / batch-insert records into a collection
   */
  static async importData(
    key: string,
    records: any[],
    mode: 'insert' | 'upsert' = 'insert',
    user?: { userId?: string; username?: string }
  ) {
    const meta = COLLECTION_REGISTRY[key];
    if (!meta) throw new Error(`Collection '${key}' is not recognized.`);
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Records must be a non-empty array.');
    }

    let inserted = 0;
    let updated = 0;

    for (const row of records) {
      delete row._id;
      if (!row.id) row.id = randomUUID();
      if (meta.dateField && !row[meta.dateField]) row[meta.dateField] = new Date();

      if (mode === 'upsert') {
        const res = await meta.model.findOneAndUpdate(
          { id: row.id },
          { $set: row },
          { upsert: true, new: true }
        );
        if (res) updated++;
      } else {
        await meta.model.create(row);
        inserted++;
      }
    }

    await createAuditLog({
      userId: user?.userId,
      username: user?.username,
      module: 'Database Tools',
      action: 'BATCH_IMPORT_RECORDS',
      newValue: { collection: key, mode, count: records.length }
    });

    return {
      success: true,
      collection: key,
      processed: records.length,
      inserted,
      updated
    };
  }

  /**
   * 8. Preview data count for a specific date or date range across all transactional collections
   */
  static async previewDateData(startDate: string, endDate?: string) {
    const end = endDate || startDate;
    const transactionalEntries = Object.values(COLLECTION_REGISTRY).filter(
      (c) => c.category === 'TRANSACTIONAL' && c.dateField
    );

    const breakdown: Record<string, { name: string; count: number }> = {};
    let totalRecords = 0;

    await Promise.all(
      transactionalEntries.map(async (c) => {
        const dateQ = buildDateQuery(c.dateField!, startDate, end);
        let count = 0;
        if (dateQ) {
          count = await c.model.countDocuments(dateQ);
        }
        breakdown[c.key] = { name: c.name, count };
        totalRecords += count;
      })
    );

    return {
      dateRange: { startDate, endDate: end },
      totalRecords,
      breakdown
    };
  }

  /**
   * 9. Permanently purge data for a specific date or date range
   * - Enforces strict safety confirmation
   * - Operates on requested transactional collections
   * - Resets active table statuses if all their orders are removed
   */
  static async purgeDateData(
    options: {
      startDate: string;
      endDate?: string;
      collections?: string[];
      confirmationPhrase: string;
    },
    user?: { userId?: string; username?: string }
  ) {
    const end = options.endDate || options.startDate;
    const expectedPhrase1 = `DELETE ${options.startDate}`;
    const expectedPhrase2 = `DELETE ${options.startDate}_TO_${end}`;
    const expectedPhrase3 = 'DELETE ALL DATA';

    const cleanInput = (options.confirmationPhrase || '').trim().toUpperCase();
    if (
      cleanInput !== expectedPhrase1.toUpperCase() &&
      cleanInput !== expectedPhrase2.toUpperCase() &&
      cleanInput !== expectedPhrase3
    ) {
      throw new Error(
        `Confirmation phrase mismatch. You must type "${expectedPhrase1}" to confirm permanent purge.`
      );
    }

    // Default to all transactional collections if not specified
    const targetKeys = options.collections && options.collections.length > 0
      ? options.collections
      : Object.values(COLLECTION_REGISTRY)
          .filter((c) => c.category === 'TRANSACTIONAL')
          .map((c) => c.key);

    const deletedCounts: Record<string, number> = {};
    let totalDeleted = 0;

    for (const key of targetKeys) {
      const meta = COLLECTION_REGISTRY[key];
      if (!meta) continue;

      // Master protection check
      if (meta.category === 'SYSTEM') {
        throw new Error(`Cannot purge system security collection '${meta.name}'.`);
      }

      if (meta.dateField) {
        const dateQ = buildDateQuery(meta.dateField, options.startDate, end);
        if (dateQ) {
          const res = await meta.model.deleteMany(dateQ);
          deletedCounts[key] = res.deletedCount || 0;
          totalDeleted += res.deletedCount || 0;
        }
      }
    }

    // If orders or bills were purged, sanitize table states
    if (deletedCounts['orders'] || deletedCounts['bills']) {
      try {
        const occupiedTables = await DiningTable.find({ status: 'OCCUPIED' });
        for (const tbl of occupiedTables) {
          if (tbl.currentOrderId) {
            const orderStillExists = await Order.exists({ id: tbl.currentOrderId });
            if (!orderStillExists) {
              await DiningTable.updateOne(
                { id: tbl.id },
                { $set: { status: 'AVAILABLE', currentOrderId: null } }
              );
            }
          }
        }
      } catch (_) {}
    }

    // High-priority audit log
    await createAuditLog({
      userId: user?.userId,
      username: user?.username,
      module: 'Database Tools',
      action: 'PERMANENT_DATE_PURGE',
      newValue: {
        startDate: options.startDate,
        endDate: end,
        totalDeleted,
        breakdown: deletedCounts
      }
    });

    return {
      success: true,
      message: `Permanently purged ${totalDeleted} records for ${options.startDate}${end !== options.startDate ? ' to ' + end : ''}.`,
      dateRange: { startDate: options.startDate, endDate: end },
      totalDeleted,
      deletedCounts
    };
  }
}
