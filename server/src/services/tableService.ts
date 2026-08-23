import { DiningTable } from '../models/Master';
import { Order } from '../models/Order';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';

export class TableService {
  static async getFloorLayout() {
    const tables = await DiningTable.find().sort({ tableNumber: 1 });
    const orders = await Order.find({ status: { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED'] } });
    
    // Attach live order data to tables
    return tables.map(t => {
      const activeOrder = orders.find(o => o.tableId === t.id);
      return {
        ...t.toObject(),
        activeOrder: activeOrder ? {
          id: activeOrder.id,
          orderNumber: activeOrder.orderNumber,
          netAmount: activeOrder.netAmount,
          itemCount: activeOrder.items.length,
          status: activeOrder.status,
          createdAt: activeOrder.createdAt
        } : null
      };
    });
  }

  static async updateStatus(tableId: string, status: string, userId?: string, username?: string) {
    const old = await DiningTable.findOne({ id: tableId });
    const updated = await DiningTable.findOneAndUpdate(
      { id: tableId },
      { $set: { status } },
      { new: true }
    );
    SocketEvents.emitTableUpdated(updated);

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'STATUS_CHANGE',
      recordId: tableId,
      oldValue: { status: old?.status },
      newValue: { status }
    });

    return updated;
  }

  static async transferTable(sourceTableId: string, destTableId: string, userId?: string, username?: string) {
    const sourceTable = await DiningTable.findOne({ id: sourceTableId });
    const destTable = await DiningTable.findOne({ id: destTableId });

    if (!sourceTable || !destTable) {
      throw { statusCode: 404, message: 'Table not found.' };
    }

    if (destTable.status === 'OCCUPIED') {
      throw { statusCode: 400, message: 'Destination table is currently occupied.' };
    }

    // Find active order on source table
    const activeOrder = await Order.findOne({ 
      tableId: sourceTableId, 
      status: { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED'] } 
    });

    if (activeOrder) {
      activeOrder.tableId = destTableId;
      activeOrder.tableNumber = destTable.tableNumber;
      await activeOrder.save();
    }

    sourceTable.status = 'AVAILABLE';
    sourceTable.currentOrderId = undefined;
    await sourceTable.save();

    destTable.status = 'OCCUPIED';
    destTable.currentOrderId = activeOrder?.id;
    await destTable.save();

    SocketEvents.emitTableUpdated(sourceTable);
    SocketEvents.emitTableUpdated(destTable);

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'TRANSFER_TABLE',
      recordId: destTableId,
      oldValue: { fromTable: sourceTable.tableNumber },
      newValue: { toTable: destTable.tableNumber, orderId: activeOrder?.id }
    });

    return { success: true, message: `Transferred from ${sourceTable.tableNumber} to ${destTable.tableNumber}` };
  }

  static async mergeTables(primaryTableId: string, secondaryTableIds: string[]) {
    await DiningTable.updateMany(
      { id: { $in: secondaryTableIds } },
      { $set: { status: 'OCCUPIED' } }
    );
    return { success: true, message: 'Tables merged successfully' };
  }

  static async splitTables(tableIds: string[]) {
    await DiningTable.updateMany(
      { id: { $in: tableIds } },
      { $set: { status: 'AVAILABLE' } }
    );
    return { success: true, message: 'Tables reset to available' };
  }
}
