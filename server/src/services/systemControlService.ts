import { SystemNotification, AuditLog, SystemSetting, MaintenanceLog } from '../models/System';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { runDatabaseMigrationsAndSeeds } from '../database/seedRunner';
import { User } from '../models/User';
import { Role, Permission } from '../models/Role';
import { Department, Designation, MenuCategory, MenuItem, DiningTable, Supplier, Customer } from '../models/Master';
import { InventoryItem, Recipe } from '../models/Inventory';
import { ChartOfAccount } from '../models/Account';
import { Employee } from '../models/HR';

export class NotificationService {
  static async getNotifications(userId?: string, roleId?: string) {
    const filter: any = {
      $or: [
        { recipientUserId: userId },
        { recipientRoleId: roleId },
        { recipientUserId: null, recipientRoleId: null }
      ]
    };
    return SystemNotification.find(filter).sort({ createdAt: -1 }).limit(50);
  }

  static async createNotification(data: any) {
    const id = `notif_${uuidv4().slice(0, 8)}`;
    const notif = await SystemNotification.create({
      ...data,
      id,
      isRead: false
    });
    SocketEvents.emitNotificationCreated(notif);
    return notif;
  }

  static async markAsRead(id: string) {
    return SystemNotification.findOneAndUpdate({ id }, { $set: { isRead: true } }, { new: true });
  }

  static async markAllAsRead(userId?: string) {
    return SystemNotification.updateMany({ recipientUserId: userId }, { $set: { isRead: true } });
  }
}

export class AuditService {
  static async getAuditLogs(query: any = {}) {
    const filter: any = {};
    if (query.module) filter.module = query.module;
    if (query.action) filter.action = query.action;
    if (query.username) filter.username = { $regex: query.username, $options: 'i' };
    return AuditLog.find(filter).sort({ timestamp: -1 }).limit(200);
  }
}

export class SystemControlService {
  static async getSystemStatus() {
    const statusSetting = await SystemSetting.findOne({ key: 'system_status' });
    const logs = await MaintenanceLog.find().sort({ createdAt: -1 }).limit(10);
    const allSettings = await SystemSetting.find();

    return {
      status: statusSetting?.value || 'ONLINE',
      settings: allSettings,
      recentMaintenance: logs
    };
  }

  static async setSystemStatus(
    status: 'ONLINE' | 'MAINTENANCE' | 'READ_ONLY' | 'PARTIAL_MAINTENANCE' | 'EMERGENCY_LOCKDOWN' | 'RECOVERY' | 'SYSTEM_DOWN',
    reason?: string,
    userId?: string,
    username?: string
  ) {
    await SystemSetting.findOneAndUpdate(
      { key: 'system_status' },
      { $set: { value: status, updatedAt: new Date() } },
      { upsert: true }
    );

    const log = await MaintenanceLog.create({
      id: `maint_${uuidv4().slice(0, 8)}`,
      status,
      reason: reason || `Switched status to ${status}`,
      initiatedBy: userId
    });

    SocketEvents.emitSystemStatusChanged({ status, reason, timestamp: new Date() });

    await createAuditLog({
      userId,
      username,
      module: 'System Control',
      submodule: 'Status',
      action: `SYSTEM_STATUS_${status}`,
      recordId: log.id,
      newValue: { status, reason }
    });

    return { status, log, message: `System operational mode updated to ${status}` };
  }

  static async getSettings() {
    const settings = await SystemSetting.find();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    if (settingsMap['restaurant_phone'] && !settingsMap['phone']) settingsMap['phone'] = settingsMap['restaurant_phone'];
    if (settingsMap['restaurant_email'] && !settingsMap['email']) settingsMap['email'] = settingsMap['restaurant_email'];
    if (settingsMap['restaurant_address'] && !settingsMap['address']) settingsMap['address'] = settingsMap['restaurant_address'];
    if (settingsMap['restaurant_tagline'] && !settingsMap['tagline']) settingsMap['tagline'] = settingsMap['restaurant_tagline'];
    if (settingsMap['service_charge_percentage'] && !settingsMap['service_charge_rate']) settingsMap['service_charge_rate'] = settingsMap['service_charge_percentage'];
    return settingsMap;
  }

  static async updateSettings(settings: Array<{ key: string; value: string }>, userId?: string, username?: string) {
    for (const s of settings) {
      await SystemSetting.findOneAndUpdate(
        { key: s.key },
        { $set: { value: s.value, updatedAt: new Date() } },
        { upsert: true }
      );
      // Sync aliases
      if (s.key === 'phone') {
        await SystemSetting.findOneAndUpdate({ key: 'restaurant_phone' }, { $set: { value: s.value, updatedAt: new Date() } }, { upsert: true });
      } else if (s.key === 'email') {
        await SystemSetting.findOneAndUpdate({ key: 'restaurant_email' }, { $set: { value: s.value, updatedAt: new Date() } }, { upsert: true });
      } else if (s.key === 'address') {
        await SystemSetting.findOneAndUpdate({ key: 'restaurant_address' }, { $set: { value: s.value, updatedAt: new Date() } }, { upsert: true });
      } else if (s.key === 'tagline') {
        await SystemSetting.findOneAndUpdate({ key: 'restaurant_tagline' }, { $set: { value: s.value, updatedAt: new Date() } }, { upsert: true });
      } else if (s.key === 'service_charge_rate') {
        await SystemSetting.findOneAndUpdate({ key: 'service_charge_percentage' }, { $set: { value: s.value, updatedAt: new Date() } }, { upsert: true });
      }
    }

    await createAuditLog({
      userId,
      username,
      module: 'Settings',
      action: 'UPDATE_SETTINGS',
      newValue: settings
    });

    return { success: true, message: 'Settings updated successfully.' };
  }

  static async getAllDetailedSettings() {
    return await SystemSetting.find().sort({ category: 1, key: 1 });
  }

  static async saveSingleSetting(
    setting: { key: string; value: string; category?: string; description?: string },
    userId?: string,
    username?: string
  ) {
    if (!setting.key) throw new Error('Setting key is required.');
    const updated = await SystemSetting.findOneAndUpdate(
      { key: setting.key },
      {
        $set: {
          value: setting.value,
          category: setting.category || 'CUSTOM',
          description: setting.description || '',
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    await createAuditLog({
      userId,
      username,
      module: 'Settings',
      action: 'SAVE_SINGLE_SETTING',
      newValue: setting
    });

    return updated;
  }

  static async deleteSetting(key: string, userId?: string, username?: string) {
    if (!key) throw new Error('Setting key is required.');
    const deleted = await SystemSetting.findOneAndDelete({ key });
    if (!deleted) throw new Error(`Setting with key "${key}" not found.`);

    await createAuditLog({
      userId,
      username,
      module: 'Settings',
      action: 'DELETE_SETTING',
      oldValue: { key }
    });

    return deleted;
  }

  static async createDatabaseSnapshot() {
    const [
      users,
      roles,
      permissions,
      departments,
      designations,
      menuCategories,
      menuItems,
      tables,
      suppliers,
      customers,
      inventoryItems,
      recipes,
      chartOfAccounts,
      employees,
      systemSettings
    ] = await Promise.all([
      User.find().select('-passwordHash'),
      Role.find(),
      Permission.find(),
      Department.find(),
      Designation.find(),
      MenuCategory.find(),
      MenuItem.find(),
      DiningTable.find(),
      Supplier.find(),
      Customer.find(),
      InventoryItem.find(),
      Recipe.find(),
      ChartOfAccount.find(),
      Employee.find(),
      SystemSetting.find()
    ]);

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        appName: 'Royal Heritage Restaurant ERP'
      },
      counts: {
        users: users.length,
        roles: roles.length,
        permissions: permissions.length,
        menuItems: menuItems.length,
        tables: tables.length,
        inventoryItems: inventoryItems.length,
        employees: employees.length
      },
      data: {
        users,
        roles,
        permissions,
        departments,
        designations,
        menuCategories,
        menuItems,
        tables,
        suppliers,
        customers,
        inventoryItems,
        recipes,
        chartOfAccounts,
        employees,
        systemSettings
      }
    };
  }

  static async reseedDatabase() {
    await runDatabaseMigrationsAndSeeds();
    const [permCount, roleCount, userCount] = await Promise.all([
      Permission.countDocuments(),
      Role.countDocuments(),
      User.countDocuments()
    ]);
    return {
      success: true,
      message: 'Database schema and seed integrity verified.',
      counts: {
        permissions: permCount,
        roles: roleCount,
        users: userCount
      }
    };
  }
}
