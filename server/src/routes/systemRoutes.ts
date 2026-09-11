import { Router, Response } from 'express';
import { NotificationService, AuditService, SystemControlService } from '../services/systemControlService';
import { DatabaseToolService } from '../services/databaseToolService';
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

systemRouter.get('/settings/detailed', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await SystemControlService.getAllDetailedSettings();
    return ApiResponse.success(res, settings, 'Detailed system settings loaded.');
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

systemRouter.post('/settings/single', authenticate, authorize('settings.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await SystemControlService.saveSingleSetting(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Setting saved successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

systemRouter.delete('/settings/:key', authenticate, authorize('settings.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await SystemControlService.deleteSetting(req.params.key, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Setting deleted successfully.');
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

// --- ADVANCED DATABASE MANAGEMENT & CRUD STUDIO ---

// 1. Get all collections metadata and record counts
systemRouter.get('/database/collections', authenticate, authorize('system.control.view'), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await DatabaseToolService.getCollectionList();
    return ApiResponse.success(res, list, 'Collection list retrieved successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 2. Query paginated records with search and date range
systemRouter.get('/database/query', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection, page, limit, search, startDate, endDate } = req.query;
    if (!collection) return ApiResponse.error(res, 'Collection key is required.', 400);

    const result = await DatabaseToolService.queryCollection(String(collection), {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search ? String(search) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined
    });
    return ApiResponse.success(res, result, 'Records retrieved successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 3. Direct Record Creation
systemRouter.post('/database/record', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection, data } = req.body;
    if (!collection || !data) return ApiResponse.error(res, 'Collection and data are required.', 400);

    const created = await DatabaseToolService.createRecord(collection, data, {
      userId: req.user!.userId,
      username: req.user!.username
    });
    return ApiResponse.success(res, created, 'Record created successfully.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// 4. Direct Record Update
systemRouter.put('/database/record/:id', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection, data } = req.body;
    const { id } = req.params;
    if (!collection || !data) return ApiResponse.error(res, 'Collection and data are required.', 400);

    const updated = await DatabaseToolService.updateRecord(collection, id, data, {
      userId: req.user!.userId,
      username: req.user!.username
    });
    return ApiResponse.success(res, updated, 'Record updated successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// 5. Direct Record Deletion
systemRouter.delete('/database/record/:id', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection } = req.query;
    const { id } = req.params;
    if (!collection) return ApiResponse.error(res, 'Collection is required.', 400);

    const deleted = await DatabaseToolService.deleteRecord(String(collection), id, {
      userId: req.user!.userId,
      username: req.user!.username
    });
    return ApiResponse.success(res, deleted, 'Record deleted successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// 6. Date-Filtered Data Export
systemRouter.post('/database/export', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collections, startDate, endDate } = req.body;
    const result = await DatabaseToolService.exportData({ collections, startDate, endDate });
    return ApiResponse.success(res, result, 'Data exported successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 7. Data Import
systemRouter.post('/database/import', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection, records, mode } = req.body;
    if (!collection || !records) return ApiResponse.error(res, 'Collection and records are required.', 400);

    const result = await DatabaseToolService.importData(collection, records, mode, {
      userId: req.user!.userId,
      username: req.user!.username
    });
    return ApiResponse.success(res, result, 'Data imported successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// 8. Date-Wise Preview Count
systemRouter.post('/database/date-preview', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate) return ApiResponse.error(res, 'Start date is required.', 400);

    const result = await DatabaseToolService.previewDateData(startDate, endDate);
    return ApiResponse.success(res, result, 'Date records preview generated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// 9. Permanent Date-Wise Data Purge
systemRouter.post('/database/date-purge', authenticate, authorize('system.control.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, collections, confirmationPhrase } = req.body;
    if (!startDate) return ApiResponse.error(res, 'Start date is required.', 400);
    if (!confirmationPhrase) return ApiResponse.error(res, 'Confirmation phrase is required.', 400);

    const result = await DatabaseToolService.purgeDateData({
      startDate,
      endDate,
      collections,
      confirmationPhrase
    }, {
      userId: req.user!.userId,
      username: req.user!.username
    });
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

