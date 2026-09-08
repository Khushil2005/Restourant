import { Router, Response } from 'express';
import { MasterService } from '../services/masterService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const masterRouter = Router();

// --- CUSTOMERS ---
masterRouter.get('/customers', authenticate, authorize('masters.customer.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await MasterService.getCustomers(req.query);
    return ApiResponse.success(res, list, 'Customers retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.post('/customers', authenticate, authorize('masters.customer.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cust = await MasterService.createCustomer(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, cust, 'Customer created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.put('/customers/:id', authenticate, authorize('masters.customer.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cust = await MasterService.updateCustomer(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, cust, 'Customer updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.delete('/customers/:id', authenticate, authorize('masters.customer.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await MasterService.deleteCustomer(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Customer deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.get('/customers/:id/history', authenticate, authorize('masters.customer.history'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const history = await MasterService.getCustomerHistory(req.params.id);
    return ApiResponse.success(res, history, 'Customer history loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- SUPPLIERS ---
masterRouter.get('/suppliers', authenticate, authorize('masters.supplier.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await MasterService.getSuppliers();
    return ApiResponse.success(res, list, 'Suppliers retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.post('/suppliers', authenticate, authorize('masters.supplier.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sup = await MasterService.createSupplier(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, sup, 'Supplier created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.put('/suppliers/:id', authenticate, authorize('masters.supplier.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sup = await MasterService.updateSupplier(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, sup, 'Supplier updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.delete('/suppliers/:id', authenticate, authorize('masters.supplier.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await MasterService.deleteSupplier(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Supplier deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- MENU CATEGORIES & ITEMS ---
masterRouter.get('/menu-categories', authenticate, authorize(['masters.menu.view', 'daily_menu.view', 'orders.view']), async (req, res: Response) => {
  try {
    const categories = await MasterService.getMenuCategories();
    return ApiResponse.success(res, categories, 'Menu categories retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.post('/menu-categories', authenticate, authorize('masters.menu.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cat = await MasterService.createMenuCategory(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, cat, 'Menu category created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.put('/menu-categories/:id', authenticate, authorize('masters.menu.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cat = await MasterService.updateMenuCategory(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, cat, 'Menu category updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.delete('/menu-categories/:id', authenticate, authorize('masters.menu.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await MasterService.deleteMenuCategory(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Menu category deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.get('/menu-items', authenticate, authorize(['masters.menu.view', 'daily_menu.view', 'orders.view']), async (req, res: Response) => {
  try {
    const items = await MasterService.getMenuItems(req.query.categoryId as string);
    return ApiResponse.success(res, items, 'Menu items retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.post('/menu-items', authenticate, authorize('masters.menu.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await MasterService.createMenuItem(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, item, 'Menu item created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.put('/menu-items/:id', authenticate, authorize('masters.menu.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await MasterService.updateMenuItem(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, item, 'Menu item updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.patch('/menu-items/:id/availability', authenticate, authorize('masters.menu.availability'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await MasterService.toggleMenuItemAvailability(req.params.id, req.body.isAvailable);
    return ApiResponse.success(res, item, 'Item availability updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.delete('/menu-items/:id', authenticate, authorize('masters.menu.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await MasterService.deleteMenuItem(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Menu item deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- TABLES ---
masterRouter.get('/tables', authenticate, authorize('masters.table.view'), async (req, res: Response) => {
  try {
    const tables = await MasterService.getTables();
    return ApiResponse.success(res, tables, 'Tables retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

masterRouter.post('/tables', authenticate, authorize('masters.table.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const table = await MasterService.createTable(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, table, 'Table created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.put('/tables/:id', authenticate, authorize('masters.table.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const table = await MasterService.updateTable(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, table, 'Table updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

masterRouter.delete('/tables/:id', authenticate, authorize('masters.table.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await MasterService.deleteTable(req.params.id);
    return ApiResponse.success(res, null, 'Table deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- META MASTERS ---
masterRouter.get('/departments', authenticate, async (req, res: Response) => {
  const depts = await MasterService.getDepartments();
  return ApiResponse.success(res, depts, 'Departments loaded.');
});

masterRouter.get('/designations', authenticate, async (req, res: Response) => {
  const des = await MasterService.getDesignations();
  return ApiResponse.success(res, des, 'Designations loaded.');
});

masterRouter.get('/units', authenticate, async (req, res: Response) => {
  const units = await MasterService.getUnits();
  return ApiResponse.success(res, units, 'Units loaded.');
});

masterRouter.get('/tax-masters', authenticate, async (req, res: Response) => {
  const taxes = await MasterService.getTaxMasters();
  return ApiResponse.success(res, taxes, 'Tax masters loaded.');
});
