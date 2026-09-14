import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../models/System';

export interface AuditLogPayload {
  userId?: string;
  username?: string;
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
  status?: 'SUCCESS' | 'FAILED';
}

export async function createAuditLog(entry: AuditLogPayload): Promise<void> {
  try {
    const id = uuidv4();
    await AuditLog.create({
      id,
      userId: entry.userId || undefined,
      username: entry.username || 'SYSTEM',
      roleName: entry.roleName || undefined,
      module: entry.module,
      submodule: entry.submodule,
      functionName: entry.functionName,
      action: entry.action,
      recordId: entry.recordId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      ipAddress: entry.ipAddress || '127.0.0.1',
      deviceInfo: entry.deviceInfo || 'API_CLIENT',
      status: entry.status || 'SUCCESS',
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[Audit Log Writing Error]:', err);
  }
}
