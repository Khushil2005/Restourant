import { Router, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { RecipeService } from '../services/recipeService';
import { PurchaseService } from '../services/purchaseService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const inventoryRouter = Router();

// --- INVENTORY STOCK ---
inventoryRouter.get('/items', authenticate, authorize('inventory.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await InventoryService.getItems(req.query);
    return ApiResponse.success(res, items, 'Inventory items retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

inventoryRouter.post('/items', authenticate, authorize('inventory.item.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await InventoryService.createItem(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, item, 'Inventory item created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

inventoryRouter.put('/items/:id', authenticate, authorize('inventory.item.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await InventoryService.updateItem(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, item, 'Inventory item updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

inventoryRouter.post('/stock-in', authenticate, authorize('inventory.stock_in'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await InventoryService.performStockIn(req.body.itemId, Number(req.body.quantity), Number(req.body.unitPrice || 0), req.body.notes, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Stock In recorded successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

inventoryRouter.post('/stock-out', authenticate, authorize('inventory.stock_out'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await InventoryService.performStockOut(req.body.itemId, Number(req.body.quantity), req.body.notes, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Stock Out recorded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

inventoryRouter.post('/adjust', authenticate, authorize('inventory.adjust'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await InventoryService.adjustStock(req.body.itemId, req.body.type, Number(req.body.quantity), req.body.reason, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Stock adjustment recorded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

inventoryRouter.post('/transfer', authenticate, authorize('inventory.transfer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const transfer = await InventoryService.transferStock(req.body, req.user!.userId);
    return ApiResponse.success(res, transfer, 'Stock transferred.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

inventoryRouter.get('/ledger', authenticate, authorize('inventory.ledger'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ledger = await InventoryService.getStockLedger(req.query.itemId as string);
    return ApiResponse.success(res, ledger, 'Stock ledger loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

inventoryRouter.get('/valuation', authenticate, authorize('inventory.valuation'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const valuation = await InventoryService.getStockValuation();
    return ApiResponse.success(res, valuation, 'Stock valuation loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

// --- RECIPES ---
inventoryRouter.get('/recipes', authenticate, authorize('inventory.recipe.view'), async (req, res: Response) => {
  try {
    const recipes = await RecipeService.getRecipes();
    return ApiResponse.success(res, recipes, 'Recipes loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

inventoryRouter.post('/recipes', authenticate, authorize('inventory.recipe.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipe = await RecipeService.createOrUpdateRecipe(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, recipe, 'Recipe saved successfully.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const purchaseRouter = Router();

purchaseRouter.get('/orders', authenticate, authorize('purchase.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pos = await PurchaseService.getPurchaseOrders(req.query);
    return ApiResponse.success(res, pos, 'Purchase orders loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

purchaseRouter.post('/orders', authenticate, authorize('purchase.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const po = await PurchaseService.createPurchaseOrder(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, po, 'Purchase order created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

purchaseRouter.patch('/orders/:id/approve', authenticate, authorize('purchase.approve'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const po = await PurchaseService.approvePurchaseOrder(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, po, 'Purchase order approved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

purchaseRouter.post('/orders/:id/receive', authenticate, authorize('purchase.receive'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await PurchaseService.receiveGoods(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Goods received and stock incremented.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

purchaseRouter.get('/invoices', authenticate, authorize('purchase.invoice'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoices = await PurchaseService.getPurchaseInvoices();
    return ApiResponse.success(res, invoices, 'Purchase invoices loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

purchaseRouter.post('/invoices/:id/pay', authenticate, authorize('purchase.payment'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const inv = await PurchaseService.recordSupplierPayment(req.params.id, Number(req.body.amount), req.body.paymentMethod, req.user!.userId);
    return ApiResponse.success(res, inv, 'Supplier payment recorded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});
