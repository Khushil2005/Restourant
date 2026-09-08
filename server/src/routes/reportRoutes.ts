import { Router, Response } from 'express';
import { ReportService } from '../services/reportService';
import { UserRoleService } from '../services/userRoleService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const reportRouter = Router();

reportRouter.get('/sales', authenticate, authorize('reports.sales.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await ReportService.getSalesReport(req.query.startDate as string, req.query.endDate as string);
    return ApiResponse.success(res, report, 'Sales report loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

reportRouter.get('/payments', authenticate, authorize('reports.payment.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await ReportService.getPaymentReport(req.query.startDate as string, req.query.endDate as string);
    return ApiResponse.success(res, report, 'Payment report loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

reportRouter.get('/inventory', authenticate, authorize('reports.inventory.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await ReportService.getInventoryReport();
    return ApiResponse.success(res, report, 'Inventory report loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

reportRouter.get('/financials', authenticate, authorize('reports.accounts.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await ReportService.getFinancialReport();
    return ApiResponse.success(res, report, 'Financial statements report loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

export const userRoleRouter = Router();

// --- USERS ---
userRoleRouter.get('/users', authenticate, authorize('users.view'), async (req, res: Response) => {
  try {
    const users = await UserRoleService.getUsers();
    return ApiResponse.success(res, users, 'Users retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

userRoleRouter.get('/users/:id', authenticate, authorize('users.view'), async (req, res: Response) => {
  try {
    const user = await UserRoleService.getUserById(req.params.id);
    return ApiResponse.success(res, user, 'User details loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 404);
  }
});

userRoleRouter.post('/users', authenticate, authorize('users.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserRoleService.createUser(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, user, 'User created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

userRoleRouter.put('/users/:id', authenticate, authorize('users.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserRoleService.updateUser(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, user, 'User updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

userRoleRouter.delete('/users/:id', authenticate, authorize('users.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await UserRoleService.deleteUser(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'User deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

// --- ROLES ---
userRoleRouter.get('/roles', authenticate, authorize('roles.view'), async (req, res: Response) => {
  try {
    const roles = await UserRoleService.getRoles();
    return ApiResponse.success(res, roles, 'Roles retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

userRoleRouter.post('/roles', authenticate, authorize('roles.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = await UserRoleService.createRole(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, role, 'Role created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

userRoleRouter.put('/roles/:id/permissions', authenticate, authorize('roles.permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = await UserRoleService.updateRolePermissions(req.params.id, req.body.permissions, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, role, 'Role permissions updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

userRoleRouter.delete('/roles/:id', authenticate, authorize('roles.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await UserRoleService.deleteRole(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Role deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

// --- PERMISSIONS TREE ---
userRoleRouter.get('/permissions-tree', authenticate, async (req, res: Response) => {
  try {
    const tree = await UserRoleService.getPermissionsTree();
    return ApiResponse.success(res, tree, 'Permissions tree loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});
