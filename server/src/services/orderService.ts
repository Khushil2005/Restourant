import { Order, IOrderItem } from '../models/Order';
import { KOTTicket, IKOTItem } from '../models/KOT';
import { DiningTable } from '../models/Master';
import { Recipe } from '../models/Inventory';
import { InventoryItem, StockTransaction } from '../models/Inventory';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class OrderService {
  static async getOrders(query: any = {}) {
    const filter: any = {};
    if (query.status) {
      filter.status = query.status === 'ACTIVE' 
        ? { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED'] } 
        : query.status;
    }
    if (query.orderType) filter.orderType = query.orderType;
    if (query.tableId) filter.tableId = query.tableId;

    return Order.find(filter).sort({ createdAt: -1 });
  }

  static async getOrderById(id: string) {
    const order = await Order.findOne({ id });
    if (!order) throw { statusCode: 404, message: 'Order not found.' };
    return order;
  }

  static async createOrder(data: any, userId?: string, username?: string) {
    const count = await Order.countDocuments();
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const id = `ord_${uuidv4().slice(0, 8)}`;

    // Process items & calculations
    let totalAmount = 0;
    let taxAmount = 0;

    const items: IOrderItem[] = data.items.map((it: any) => {
      const lineTotal = it.quantity * it.unitPrice;
      const lineTax = (lineTotal * (it.taxRate || 5)) / 100;
      totalAmount += lineTotal;
      taxAmount += lineTax;
      return {
        id: uuidv4(),
        menuItemId: it.menuItemId,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: lineTotal,
        taxAmount: lineTax,
        discountAmount: 0,
        notes: it.notes,
        status: 'KOT_SENT',
        createdAt: new Date()
      };
    });

    const netAmount = totalAmount + taxAmount - (data.discountAmount || 0);

    const order = await Order.create({
      id,
      orderNumber,
      orderType: data.orderType || 'DINE_IN',
      tableId: data.tableId,
      tableNumber: data.tableNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      deliveryAddress: data.deliveryAddress,
      status: 'IN_KITCHEN',
      items,
      totalAmount,
      taxAmount,
      discountAmount: data.discountAmount || 0,
      netAmount,
      waiterId: data.waiterId || userId,
      createdBy: userId,
      notes: data.notes
    });

    // Update Table status
    if (data.tableId) {
      await DiningTable.findOneAndUpdate(
        { id: data.tableId },
        { $set: { status: 'OCCUPIED', currentOrderId: id } }
      );
      SocketEvents.emitTableUpdated({ tableId: data.tableId, status: 'OCCUPIED' });
    }

    // Auto-generate initial KOT ticket
    const kotCount = await KOTTicket.countDocuments();
    const kotNumber = `KOT-${String(kotCount + 1001)}`;
    const kotId = `kot_${uuidv4().slice(0, 8)}`;

    const kotItems: IKOTItem[] = items.map(it => ({
      id: uuidv4(),
      orderItemId: it.id,
      menuItemId: it.menuItemId,
      itemName: it.itemName,
      quantity: it.quantity,
      notes: it.notes,
      status: 'NEW'
    }));

    const kot = await KOTTicket.create({
      id: kotId,
      kotNumber,
      orderId: id,
      tableId: data.tableId,
      tableNumber: data.tableNumber,
      orderType: data.orderType || 'DINE_IN',
      status: 'NEW',
      priority: data.priority || 'NORMAL',
      items: kotItems,
      createdBy: userId
    });

    SocketEvents.emitOrderCreated(order);
    SocketEvents.emitKOTCreated(kot);

    await createAuditLog({
      userId,
      username,
      module: 'POS / Orders',
      submodule: 'Terminal',
      action: 'CREATE_ORDER',
      recordId: id,
      newValue: order
    });

    return { order, kot };
  }

  static async addItemsToOrder(orderId: string, newItems: any[], userId?: string, username?: string) {
    const order = await Order.findOne({ id: orderId });
    if (!order) throw { statusCode: 404, message: 'Order not found.' };

    let addedTotal = 0;
    let addedTax = 0;
    const processedItems: IOrderItem[] = [];

    newItems.forEach((it: any) => {
      const lineTotal = it.quantity * it.unitPrice;
      const lineTax = (lineTotal * (it.taxRate || 5)) / 100;
      addedTotal += lineTotal;
      addedTax += lineTax;

      const itemObj: IOrderItem = {
        id: uuidv4(),
        menuItemId: it.menuItemId,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: lineTotal,
        taxAmount: lineTax,
        discountAmount: 0,
        notes: it.notes,
        status: 'KOT_SENT',
        createdAt: new Date()
      };
      order.items.push(itemObj);
      processedItems.push(itemObj);
    });

    order.totalAmount += addedTotal;
    order.taxAmount += addedTax;
    order.netAmount = order.totalAmount + order.taxAmount - (order.discountAmount || 0);
    order.status = 'IN_KITCHEN';
    await order.save();

    // Generate Running KOT for the new items
    const kotCount = await KOTTicket.countDocuments();
    const kotNumber = `KOT-${String(kotCount + 1001)}`;
    const kotId = `kot_${uuidv4().slice(0, 8)}`;

    const kotItems: IKOTItem[] = processedItems.map(it => ({
      id: uuidv4(),
      orderItemId: it.id,
      menuItemId: it.menuItemId,
      itemName: it.itemName,
      quantity: it.quantity,
      notes: it.notes,
      status: 'NEW'
    }));

    const kot = await KOTTicket.create({
      id: kotId,
      kotNumber,
      orderId: order.id,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      orderType: order.orderType,
      status: 'NEW',
      items: kotItems,
      createdBy: userId
    });

    SocketEvents.emitOrderUpdated(order);
    SocketEvents.emitKOTCreated(kot);

    return { order, kot };
  }

  static async holdOrder(orderId: string) {
    const order = await Order.findOneAndUpdate(
      { id: orderId },
      { $set: { isHeld: true, status: 'ON_HOLD' } },
      { new: true }
    );
    if (order) SocketEvents.emitOrderUpdated(order);
    return order;
  }

  static async resumeOrder(orderId: string) {
    const order = await Order.findOneAndUpdate(
      { id: orderId },
      { $set: { isHeld: false, status: 'IN_KITCHEN' } },
      { new: true }
    );
    if (order) SocketEvents.emitOrderUpdated(order);
    return order;
  }

  static async cancelOrder(orderId: string, reason?: string, userId?: string, username?: string) {
    const order = await Order.findOne({ id: orderId });
    if (!order) throw { statusCode: 404, message: 'Order not found.' };

    order.status = 'CANCELLED';
    order.notes = (order.notes ? `${order.notes}; ` : '') + `Cancelled: ${reason || 'N/A'}`;
    await order.save();

    if (order.tableId) {
      await DiningTable.findOneAndUpdate(
        { id: order.tableId },
        { $set: { status: 'AVAILABLE', currentOrderId: undefined } }
      );
      SocketEvents.emitTableUpdated({ tableId: order.tableId, status: 'AVAILABLE' });
    }

    await KOTTicket.updateMany(
      { orderId: order.id },
      { $set: { status: 'CANCELLED' } }
    );

    SocketEvents.emitOrderUpdated(order);

    await createAuditLog({
      userId,
      username,
      module: 'POS / Orders',
      action: 'CANCEL_ORDER',
      recordId: orderId,
      oldValue: { status: 'ACTIVE' },
      newValue: { status: 'CANCELLED', reason }
    });

    return order;
  }

  /**
   * Complete order and perform automatic Recipe-based ingredient deduction from Inventory!
   */
  static async completeOrder(orderId: string, userId?: string, username?: string) {
    const order = await Order.findOne({ id: orderId });
    if (!order) throw { statusCode: 404, message: 'Order not found.' };

    order.status = 'COMPLETED';
    await order.save();

    if (order.tableId) {
      await DiningTable.findOneAndUpdate(
        { id: order.tableId },
        { $set: { status: 'AVAILABLE', currentOrderId: undefined } }
      );
      SocketEvents.emitTableUpdated({ tableId: order.tableId, status: 'AVAILABLE' });
    }

    // AUTOMATIC RECIPE INVENTORY CONSUMPTION
    try {
      for (const item of order.items) {
        const recipe = await Recipe.findOne({ menuItemId: item.menuItemId });
        if (recipe && recipe.ingredients) {
          for (const ing of recipe.ingredients) {
            const consumedQty = ing.quantity * item.quantity;
            const invItem = await InventoryItem.findOne({ id: ing.inventoryItemId });

            if (invItem) {
              const stockBefore = invItem.currentStock;
              const stockAfter = Math.max(0, stockBefore - consumedQty);

              invItem.currentStock = stockAfter;
              await invItem.save();

              // Record stock transaction ledger entry
              await StockTransaction.create({
                id: uuidv4(),
                itemId: invItem.id,
                itemName: invItem.name,
                transactionType: 'RECIPE_CONSUMPTION',
                quantity: consumedQty,
                unitPrice: invItem.costPerUnit,
                totalCost: consumedQty * invItem.costPerUnit,
                referenceType: 'ORDER',
                referenceId: order.orderNumber,
                stockBefore,
                stockAfter,
                notes: `Auto consumption for ${item.quantity}x ${item.itemName}`,
                createdBy: userId
              });

              // Check Low Stock Trigger
              if (stockAfter <= invItem.minimumStockLevel) {
                SocketEvents.emitLowStockAlert(invItem);
              }
            }
          }
        }
      }
    } catch (ingErr) {
      console.error('[Auto Recipe Inventory Deduction Error]:', ingErr);
    }

    SocketEvents.emitOrderUpdated(order);

    await createAuditLog({
      userId,
      username,
      module: 'POS / Orders',
      action: 'COMPLETE_ORDER',
      recordId: orderId,
      newValue: { status: 'COMPLETED' }
    });

    return order;
  }
}
