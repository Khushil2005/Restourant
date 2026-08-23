import { SystemNotification, AuditLog, SystemSetting, MaintenanceLog } from '../models/System';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

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

  static async updateSettings(settings: Array<{ key: string; value: string }>, userId?: string, username?: string) {
    for (const s of settings) {
      await SystemSetting.findOneAndUpdate(
        { key: s.key },
        { $set: { value: s.value, updatedAt: new Date() } },
        { upsert: true }
      );
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
}
