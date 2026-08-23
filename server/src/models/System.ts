import { Schema, model, Document } from 'mongoose';

// Audit Log
export interface IAuditLog extends Document {
  id: string;
  userId?: string;
  username: string;
  roleName?: string;
  module: string;
  submodule?: string;
  functionName?: string;
  action: string;
  recordId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  deviceInfo?: string;
  status: 'SUCCESS' | 'FAILED';
  timestamp: Date;
}
const AuditLogSchema = new Schema<IAuditLog>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, ref: 'User' },
  username: { type: String, required: true },
  roleName: { type: String },
  module: { type: String, required: true, index: true },
  submodule: { type: String },
  functionName: { type: String },
  action: { type: String, required: true },
  recordId: { type: String },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  deviceInfo: { type: String },
  status: { type: String, default: 'SUCCESS' },
  timestamp: { type: Date, default: Date.now, index: true }
});

// System Notification
export interface ISystemNotification extends Document {
  id: string;
  type: string;
  title: string;
  message: string;
  recipientUserId?: string;
  recipientRoleId?: string;
  isRead: boolean;
  dataPayload?: any;
  createdAt: Date;
}
const SystemNotificationSchema = new Schema<ISystemNotification>({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipientUserId: { type: String, ref: 'User' },
  recipientRoleId: { type: String, ref: 'Role' },
  isRead: { type: Boolean, default: false },
  dataPayload: { type: Schema.Types.Mixed }
}, { timestamps: true });

// System Setting
export interface ISystemSetting extends Document {
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedAt: Date;
}
const SystemSettingSchema = new Schema<ISystemSetting>({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: String, required: true },
  category: { type: String, default: 'GENERAL' },
  description: { type: String }
}, { timestamps: true });

// Maintenance Log
export interface IMaintenanceLog extends Document {
  id: string;
  status: string;
  reason?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  initiatedBy?: string;
  createdAt: Date;
}
const MaintenanceLogSchema = new Schema<IMaintenanceLog>({
  id: { type: String, required: true, unique: true },
  status: { type: String, required: true },
  reason: { type: String },
  scheduledStart: { type: Date },
  scheduledEnd: { type: Date },
  initiatedBy: { type: String, ref: 'User' }
}, { timestamps: true });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
export const SystemNotification = model<ISystemNotification>('SystemNotification', SystemNotificationSchema);
export const SystemSetting = model<ISystemSetting>('SystemSetting', SystemSettingSchema);
export const MaintenanceLog = model<IMaintenanceLog>('MaintenanceLog', MaintenanceLogSchema);
