import { InventoryItem, StockTransaction, StockAdjustment, StockTransfer } from '../models/Inventory';
import { Unit } from '../models/Master';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class InventoryService {
  static async getItems(query: any = {}) {
    const filter: any = {};
    if (query.category) filter.category = query.category;
    if (query.lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$minimumStockLevel'] };
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { itemCode: { $regex: query.search, $options: 'i' } }
      ];
    }
    return InventoryItem.find(filter).sort({ name: 1 });
  }

  static async createItem(data: any, userId?: string, username?: string) {
    const id = `inv_${uuidv4().slice(0, 8)}`;
    const unit = await Unit.findOne({ id: data.unitId });
    const item = await InventoryItem.create({
      ...data,
      id,
      unitSymbol: unit?.symbol || data.unitSymbol
    });

    if (data.currentStock > 0) {
      await StockTransaction.create({
        id: uuidv4(),
        itemId: id,
        itemName: item.name,
        transactionType: 'OPENING',
        quantity: data.currentStock,
        unitPrice: data.costPerUnit || 0,
        totalCost: data.currentStock * (data.costPerUnit || 0),
        referenceType: 'MANUAL',
        stockBefore: 0,
        stockAfter: data.currentStock,
        notes: 'Initial opening stock entry',
        createdBy: userId
      });
    }

    await createAuditLog({
      userId,
      username,
      module: 'Inventory / Stock',
      submodule: 'Items',
      action: 'CREATE_ITEM',
      recordId: id,
      newValue: item
    });

    return item;
  }

  static async updateItem(id: string, data: any, userId?: string, username?: string) {
    const old = await InventoryItem.findOne({ id });
    const unit = data.unitId ? await Unit.findOne({ id: data.unitId }) : null;
    const updated = await InventoryItem.findOneAndUpdate(
      { id },
      { $set: { ...data, unitSymbol: unit?.symbol || old?.unitSymbol } },
      { new: true }
    );

    await createAuditLog({
      userId,
      username,
      module: 'Inventory / Stock',
      submodule: 'Items',
      action: 'EDIT_ITEM',
      recordId: id,
      oldValue: old,
      newValue: updated
    });

    return updated;
  }

  static async performStockIn(itemId: string, quantity: number, unitPrice: number, notes?: string, userId?: string, username?: string) {
    const item = await InventoryItem.findOne({ id: itemId });
    if (!item) throw { statusCode: 404, message: 'Stock item not found.' };

    const stockBefore = item.currentStock;
    const stockAfter = stockBefore + Number(quantity);

    item.currentStock = stockAfter;
    if (unitPrice > 0) item.costPerUnit = unitPrice;
    await item.save();

    const tx = await StockTransaction.create({
      id: uuidv4(),
      itemId: item.id,
      itemName: item.name,
      transactionType: 'STOCK_IN',
      quantity,
      unitPrice,
      totalCost: quantity * unitPrice,
      referenceType: 'MANUAL',
      stockBefore,
      stockAfter,
      notes: notes || 'Manual Stock In',
      createdBy: userId
    });

    await createAuditLog({
      userId,
      username,
      module: 'Inventory / Stock',
      submodule: 'Transactions',
      action: 'STOCK_IN',
      recordId: item.id,
      newValue: { quantity, stockBefore, stockAfter }
    });

    return { item, transaction: tx };
  }

  static async performStockOut(itemId: string, quantity: number, notes?: string, userId?: string, username?: string) {
    const item = await InventoryItem.findOne({ id: itemId });
    if (!item) throw { statusCode: 404, message: 'Stock item not found.' };

    const stockBefore = item.currentStock;
    const stockAfter = Math.max(0, stockBefore - Number(quantity));

    item.currentStock = stockAfter;
    await item.save();

    const tx = await StockTransaction.create({
      id: uuidv4(),
      itemId: item.id,
      itemName: item.name,
      transactionType: 'STOCK_OUT',
      quantity,
      unitPrice: item.costPerUnit,
      totalCost: quantity * item.costPerUnit,
      referenceType: 'MANUAL',
      stockBefore,
      stockAfter,
      notes: notes || 'Kitchen stock issue',
      createdBy: userId
    });

    if (stockAfter <= item.minimumStockLevel) {
      SocketEvents.emitLowStockAlert(item);
    }

    return { item, transaction: tx };
  }

  static async adjustStock(itemId: string, type: string, quantity: number, reason: string, userId?: string, username?: string) {
    const item = await InventoryItem.findOne({ id: itemId });
    if (!item) throw { statusCode: 404, message: 'Stock item not found.' };

    const count = await StockAdjustment.countDocuments();
    const adjustmentNumber = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const stockBefore = item.currentStock;
    const isIncrease = type === 'INCREASE' || type === 'CORRECTION';
    const stockAfter = isIncrease ? stockBefore + Number(quantity) : Math.max(0, stockBefore - Number(quantity));

    item.currentStock = stockAfter;
    await item.save();

    const adj = await StockAdjustment.create({
      id: `adj_${uuidv4().slice(0, 8)}`,
      adjustmentNumber,
      itemId: item.id,
      itemName: item.name,
      type,
      quantity,
      reason,
      createdBy: userId
    });

    await StockTransaction.create({
      id: uuidv4(),
      itemId: item.id,
      itemName: item.name,
      transactionType: 'ADJUSTMENT',
      quantity,
      unitPrice: item.costPerUnit,
      totalCost: quantity * item.costPerUnit,
      referenceType: 'ADJUSTMENT',
      referenceId: adjustmentNumber,
      stockBefore,
      stockAfter,
      notes: `Adjustment (${type}): ${reason}`,
      createdBy: userId
    });

    return { item, adjustment: adj };
  }

  static async transferStock(data: any, userId?: string) {
    const item = await InventoryItem.findOne({ id: data.itemId });
    if (!item) throw { statusCode: 404, message: 'Item not found.' };

    const count = await StockTransfer.countDocuments();
    const transferNumber = `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const transfer = await StockTransfer.create({
      id: `trf_${uuidv4().slice(0, 8)}`,
      transferNumber,
      sourceLocation: data.sourceLocation,
      destinationLocation: data.destinationLocation,
      itemId: item.id,
      itemName: item.name,
      quantity: data.quantity,
      status: 'COMPLETED',
      createdBy: userId
    });

    return transfer;
  }

  static async getStockLedger(itemId?: string) {
    const filter = itemId ? { itemId } : {};
    return StockTransaction.find(filter).sort({ createdAt: -1 });
  }

  static async getStockValuation() {
    const items = await InventoryItem.find({ isActive: true });
    let totalValuation = 0;
    const valuationList = items.map(i => {
      const value = i.currentStock * i.costPerUnit;
      totalValuation += value;
      return {
        id: i.id,
        itemCode: i.itemCode,
        name: i.name,
        category: i.category,
        currentStock: i.currentStock,
        unit: i.unitSymbol,
        costPerUnit: i.costPerUnit,
        totalValue: Math.round(value)
      };
    });
    return { totalValuation: Math.round(totalValuation), items: valuationList };
  }
}
