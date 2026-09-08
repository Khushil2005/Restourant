import { Router, Response } from 'express';
import { NotificationService, AuditService, SystemControlService } from '../services/systemControlService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const systemRouter = Router();

// --- NOTIFICATIONS ---
systemRouter.get('/notifications', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await NotificationService.getNotifications(req.user!.userId, req.user!.roleId);
    return ApiResponse.success(res, list, 'Notifications loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

systemRouter.post('/notifications', authenticate, authorize('notification.send'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notif = await NotificationService.createNotification(req.body);
    return ApiResponse.success(res, notif, 'Notification sent.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

systemRouter.patch('/notifications/:id/read', authenticate, async (req, res: Response) => {
  try {
    const notif = await NotificationService.markAsRead(req.params.id);
    return ApiResponse.success(res, notif, 'Marked as read.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

systemRouter.patch('/notifications/read-all', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NotificationService.markAllAsRead(req.user!.userId);
    return ApiResponse.success(res, null, 'All marked as read.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- AUDIT LOGS ---
systemRouter.get('/audit-logs', authenticate, authorize('audit.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await AuditService.getAuditLogs(req.query);
    return ApiResponse.success(res, logs, 'Audit logs retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- SYSTEM CONTROL SWITCHBOARD ---
systemRouter.get('/system-control/status', async (req, res: Response) => {
  try {
    const status = await SystemControlService.getSystemStatus();
    return ApiResponse.success(res, status, 'System status loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

systemRouter.post('/system-control/status', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    const result = await SystemControlService.setSystemStatus(status, reason, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

systemRouter.get('/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await SystemControlService.getSettings();
    return ApiResponse.success(res, settings, 'System settings loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

systemRouter.post('/settings', authenticate, authorize('settings.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await SystemControlService.updateSettings(req.body.settings, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

systemRouter.post('/database/snapshot', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await SystemControlService.createDatabaseSnapshot();
    return ApiResponse.success(res, snapshot, 'Database snapshot generated successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

systemRouter.post('/database/reseed', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await SystemControlService.reseedDatabase();
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});
