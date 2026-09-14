import { DiningTable } from '../models/Master';
import { Order } from '../models/Order';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';

export class TableService {
  static async getFloorLayout() {
    const tables = await DiningTable.find().sort({ tableNumber: 1 });
    const orders = await Order.find({ status: { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED'] } });
    
    // Attach live order data to tables (and associate parent order with merged child tables)
    return tables.map(t => {
      const activeOrder = orders.find(o => o.tableId === t.id || (t.isMergedChild && t.parentTableId && o.tableId === t.parentTableId));
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
    const table = await DiningTable.findOne({ id: tableId });
    if (!table) throw { statusCode: 404, message: 'Table not found.' };

    const oldStatus = table.status;

    // Only auto-unmerge if an OCCUPIED/CLEANING table is explicitly transitioning to AVAILABLE (cleared/vacated)
    if (oldStatus !== 'AVAILABLE' && status === 'AVAILABLE' && (table.isMerged || table.isMergedChild || (table.mergedTableIds && table.mergedTableIds.length > 0))) {
      await this.splitTables([tableId], userId, username);
      const refreshed = await DiningTable.findOne({ id: tableId });
      return refreshed || table;
    }

    table.status = status as any;
    if (status === 'AVAILABLE') {
      table.currentOrderId = undefined;
    }

    await table.save();
    SocketEvents.emitTableUpdated(table);
    SocketEvents.emitDataChanged('tables');

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'STATUS_CHANGE',
      recordId: tableId,
      oldValue: { status: oldStatus },
      newValue: { status }
    });

    return table;
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

    // Find active order on source table (including BILLED status)
    const activeOrder = await Order.findOne({ 
      $or: [
        { tableId: sourceTableId, status: { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED'] } },
        ...(sourceTable.currentOrderId ? [{ id: sourceTable.currentOrderId, status: { $ne: 'PAID' } }] : [])
      ]
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
    SocketEvents.emitDataChanged('tables');

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

  /**
   * Merges two or more tables together for large parties.
   */
  static async mergeTables(primaryTableId: string, secondaryTableIds: string[], userId?: string, username?: string) {
    if (!primaryTableId || !Array.isArray(secondaryTableIds) || secondaryTableIds.length === 0) {
      throw { statusCode: 400, message: 'Please select a primary table and at least one secondary table to merge.' };
    }

    const allTableIds = Array.from(new Set([primaryTableId, ...secondaryTableIds]));
    if (allTableIds.length < 2) {
      throw { statusCode: 400, message: 'At least 2 unique tables are required to merge.' };
    }

    const tables = await DiningTable.find({ id: { $in: allTableIds } });
    if (tables.length !== allTableIds.length) {
      throw { statusCode: 404, message: 'One or more selected tables were not found.' };
    }

    const primaryTable = tables.find(t => t.id === primaryTableId);
    if (!primaryTable) {
      throw { statusCode: 404, message: 'Primary table not found.' };
    }

    const secondaryTables = tables.filter(t => t.id !== primaryTableId);

    // Calculate aggregated capacity & table labels
    const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 4), 0);
    const allTableNumbers = [primaryTable.tableNumber, ...secondaryTables.map(s => s.tableNumber)];

    // Check if any of the merged tables already has an active order
    const activeOrder = await Order.findOne({
      tableId: { $in: allTableIds },
      status: { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED'] }
    });

    // Update primary table
    primaryTable.isMerged = true;
    primaryTable.mergedTableIds = allTableIds;
    primaryTable.mergedTableNumbers = allTableNumbers;
    primaryTable.mergedCapacity = totalCapacity;
    primaryTable.isMergedChild = false;
    primaryTable.parentTableId = undefined;
    primaryTable.parentTableNumber = undefined;

    if (activeOrder) {
      activeOrder.tableId = primaryTable.id;
      activeOrder.tableNumber = allTableNumbers.join(' + ');
      await activeOrder.save();

      primaryTable.status = 'OCCUPIED';
      primaryTable.currentOrderId = activeOrder.id;
    }

    await primaryTable.save();

    // Update secondary / child tables
    for (const sec of secondaryTables) {
      sec.isMerged = false;
      sec.isMergedChild = true;
      sec.parentTableId = primaryTable.id;
      sec.parentTableNumber = primaryTable.tableNumber;
      sec.mergedTableIds = allTableIds;
      sec.mergedTableNumbers = allTableNumbers;
      sec.status = 'OCCUPIED'; // Lock secondary table as part of merged group
      if (activeOrder) {
        sec.currentOrderId = activeOrder.id;
      }
      await sec.save();
    }

    // Broadcast table updates
    for (const t of tables) {
      SocketEvents.emitTableUpdated(t);
    }
    SocketEvents.emitDataChanged('tables');

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'MERGE_TABLES',
      recordId: primaryTableId,
      newValue: {
        primaryTable: primaryTable.tableNumber,
        mergedTables: allTableNumbers,
        combinedCapacity: totalCapacity
      }
    });

    return {
      success: true,
      message: `Tables ${allTableNumbers.join(' + ')} merged successfully (${totalCapacity} Seats).`,
      primaryTable,
      secondaryTables
    };
  }

  /**
   * Unmerges a merged table group back to original individual tables.
   */
  static async splitTables(tableIds?: string[] | string, userId?: string, username?: string) {
    let targetIds: string[] = [];
    if (typeof tableIds === 'string') {
      targetIds = [tableIds];
    } else if (Array.isArray(tableIds)) {
      targetIds = tableIds;
    }

    if (targetIds.length === 0) {
      throw { statusCode: 400, message: 'No table IDs provided for split/unmerge.' };
    }

    // Find any tables matching targetIds to locate primary/parent IDs
    const matchedTables = await DiningTable.find({ id: { $in: targetIds } });
    if (matchedTables.length === 0) {
      throw { statusCode: 404, message: 'Tables not found.' };
    }

    // Collect all primary table IDs and all child table IDs
    const allGroupTableIds = new Set<string>();
    for (const t of matchedTables) {
      allGroupTableIds.add(t.id);
      if (t.mergedTableIds && t.mergedTableIds.length > 0) {
        t.mergedTableIds.forEach(id => allGroupTableIds.add(id));
      }
      if (t.parentTableId) {
        allGroupTableIds.add(t.parentTableId);
      }
    }

    // Also find any tables that have parentTableId matching any of the identified primary tables
    const childTables = await DiningTable.find({ parentTableId: { $in: Array.from(allGroupTableIds) } });
    childTables.forEach(c => allGroupTableIds.add(c.id));

    const finalTables = await DiningTable.find({ id: { $in: Array.from(allGroupTableIds) } });

    for (const t of finalTables) {
      t.isMerged = false;
      t.isMergedChild = false;
      t.parentTableId = undefined;
      t.parentTableNumber = undefined;
      t.mergedTableIds = [];
      t.mergedTableNumbers = [];
      t.mergedCapacity = undefined;
      // Reset to AVAILABLE
      t.status = 'AVAILABLE';
      t.currentOrderId = undefined;
      await t.save();
      SocketEvents.emitTableUpdated(t);
    }

    SocketEvents.emitDataChanged('tables');

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'SPLIT_TABLES',
      recordId: targetIds[0],
      newValue: {
        unmergedTables: finalTables.map(t => t.tableNumber)
      }
    });

    return {
      success: true,
      message: `Tables unmerged back to individual available tables.`,
      tables: finalTables
    };
  }
}
