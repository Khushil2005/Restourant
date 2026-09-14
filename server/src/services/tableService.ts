import { DiningTable } from '../models/Master';
import { Order } from '../models/Order';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';

export class TableService {
  static async getFloorLayout() {
    const tables = await DiningTable.find().sort({ tableNumber: 1 });
    const orders = await Order.find({ status: { $in: ['NEW', 'IN_KITCHEN', 'READY', 'SERVED', 'BILLED'] } });
    
    const orderMap = new Map<string, any>();
    orders.forEach(o => {
      if (o.tableId) {
        orderMap.set(o.tableId, {
          id: o.id,
          orderNumber: o.orderNumber,
          netAmount: o.netAmount,
          itemCount: o.items.length,
          status: o.status,
          createdAt: o.createdAt
        });
      }
    });

    // Attach live order data to tables (resolving primary order for secondary merged tables)
    return tables.map(t => {
      const activeOrder = orderMap.get(t.id) || (t.parentTableId ? orderMap.get(t.parentTableId) : null) || null;
      return {
        ...t.toObject(),
        activeOrder
      };
    });
  }

  static async updateStatus(tableId: string, status: string, userId?: string, username?: string) {
    const old = await DiningTable.findOne({ id: tableId });
    if (!old) throw { statusCode: 404, message: 'Table not found.' };

    const updateFields: any = { status };
    if (status === 'AVAILABLE') {
      updateFields.currentOrderId = undefined;
      updateFields.isMerged = false;
      updateFields.mergedWithTableIds = [];
      updateFields.mergedWithTableNumbers = [];
      updateFields.parentTableId = undefined;
      updateFields.parentTableNumber = undefined;
      updateFields.mergedCapacity = undefined;
    }

    const updated = await DiningTable.findOneAndUpdate(
      { id: tableId },
      { $set: updateFields },
      { new: true }
    );

    // If this table was primary in a merge and is cleared/cleaned, also reset secondary tables
    if (old.isMerged && old.mergedWithTableIds && old.mergedWithTableIds.length > 0 && (status === 'AVAILABLE' || status === 'CLEANING')) {
      await DiningTable.updateMany(
        { id: { $in: old.mergedWithTableIds } },
        { 
          $set: { 
            status, 
            currentOrderId: undefined,
            isMerged: false,
            mergedWithTableIds: [],
            mergedWithTableNumbers: [],
            parentTableId: undefined,
            parentTableNumber: undefined,
            mergedCapacity: undefined
          } 
        }
      );
      old.mergedWithTableIds.forEach(secId => SocketEvents.emitTableUpdated({ tableId: secId, status }));
    }

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
    sourceTable.isMerged = false;
    sourceTable.mergedWithTableIds = [];
    sourceTable.mergedWithTableNumbers = [];
    sourceTable.parentTableId = undefined;
    sourceTable.parentTableNumber = undefined;
    sourceTable.mergedCapacity = undefined;
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

  /**
   * Merges multiple tables for a Big Family / Group with a SINGLE order and bill.
   */
  static async mergeTables(primaryTableId: string, secondaryTableIds: string[], userId?: string, username?: string) {
    if (!primaryTableId || !Array.isArray(secondaryTableIds) || secondaryTableIds.length === 0) {
      throw { statusCode: 400, message: 'Please provide a primary table and at least one secondary table to merge.' };
    }

    const filteredSecondaryIds = secondaryTableIds.filter(id => id && id !== primaryTableId);
    if (filteredSecondaryIds.length === 0) {
      throw { statusCode: 400, message: 'Cannot merge a table with itself.' };
    }

    const primaryTable = await DiningTable.findOne({ id: primaryTableId });
    if (!primaryTable) throw { statusCode: 404, message: 'Primary table not found.' };

    if (primaryTable.parentTableId) {
      throw { statusCode: 400, message: `Table ${primaryTable.tableNumber} is already merged as secondary under Table ${primaryTable.parentTableNumber}.` };
    }

    const secondaryTables = await DiningTable.find({ id: { $in: filteredSecondaryIds } });
    if (secondaryTables.length !== filteredSecondaryIds.length) {
      throw { statusCode: 404, message: 'One or more secondary tables not found.' };
    }

    // Check if any secondary table is already merged or under maintenance
    for (const sec of secondaryTables) {
      if (sec.status === 'MAINTENANCE') {
        throw { statusCode: 400, message: `Table ${sec.tableNumber} is under maintenance and cannot be merged.` };
      }
      if (sec.parentTableId && sec.parentTableId !== primaryTableId) {
        throw { statusCode: 400, message: `Table ${sec.tableNumber} is already merged with Table ${sec.parentTableNumber}.` };
      }
    }

    // Combine existing secondary IDs if already merged
    const combinedSecondaryIds = Array.from(new Set([...(primaryTable.mergedWithTableIds || []), ...filteredSecondaryIds]));
    const allSecondaryTables = await DiningTable.find({ id: { $in: combinedSecondaryIds } });
    const secondaryTableNumbers = allSecondaryTables.map(t => t.tableNumber);

    const totalCapacity = (primaryTable.capacity || 4) + allSecondaryTables.reduce((sum, t) => sum + (t.capacity || 4), 0);

    // Update primary table
    primaryTable.isMerged = true;
    primaryTable.mergedWithTableIds = combinedSecondaryIds;
    primaryTable.mergedWithTableNumbers = secondaryTableNumbers;
    primaryTable.mergedCapacity = totalCapacity;
    primaryTable.status = 'OCCUPIED';
    await primaryTable.save();

    // Update secondary tables
    for (const sec of allSecondaryTables) {
      sec.isMerged = true;
      sec.parentTableId = primaryTable.id;
      sec.parentTableNumber = primaryTable.tableNumber;
      sec.currentOrderId = primaryTable.currentOrderId;
      sec.status = 'OCCUPIED';
      await sec.save();
      SocketEvents.emitTableUpdated(sec);
    }

    SocketEvents.emitTableUpdated(primaryTable);

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'MERGE_TABLES',
      recordId: primaryTableId,
      newValue: {
        primaryTable: primaryTable.tableNumber,
        mergedWith: secondaryTableNumbers,
        totalCapacity
      }
    });

    return {
      success: true,
      message: `Tables ${primaryTable.tableNumber} + ${secondaryTableNumbers.join(' + ')} merged successfully! Total Capacity: ${totalCapacity} Seats for Big Family.`,
      primaryTable,
      secondaryTables: allSecondaryTables
    };
  }

  /**
   * Splits / Unmerges tables back to individual tables.
   */
  static async splitTables(tableIds: string[], userId?: string, username?: string) {
    if (!Array.isArray(tableIds) || tableIds.length === 0) {
      throw { statusCode: 400, message: 'Please specify tables to unmerge.' };
    }

    const tables = await DiningTable.find({ id: { $in: tableIds } });
    if (tables.length === 0) throw { statusCode: 404, message: 'No tables found.' };

    const affectedIds = new Set<string>();

    for (const tbl of tables) {
      affectedIds.add(tbl.id);
      if (tbl.parentTableId) {
        affectedIds.add(tbl.parentTableId);
      }
      if (tbl.mergedWithTableIds && tbl.mergedWithTableIds.length > 0) {
        tbl.mergedWithTableIds.forEach(id => affectedIds.add(id));
      }
    }

    const allAffectedTables = await DiningTable.find({ id: { $in: Array.from(affectedIds) } });

    for (const tbl of allAffectedTables) {
      const hasActiveOrder = tbl.currentOrderId ? true : false;
      tbl.isMerged = false;
      tbl.mergedWithTableIds = [];
      tbl.mergedWithTableNumbers = [];
      tbl.parentTableId = undefined;
      tbl.parentTableNumber = undefined;
      tbl.mergedCapacity = undefined;
      if (!hasActiveOrder) {
        tbl.status = 'AVAILABLE';
      }
      await tbl.save();
      SocketEvents.emitTableUpdated(tbl);
    }

    await createAuditLog({
      userId,
      username,
      module: 'Tables',
      submodule: 'Floor',
      action: 'SPLIT_TABLES',
      recordId: tableIds.join(','),
      newValue: { unmergedTableIds: Array.from(affectedIds) }
    });

    return { success: true, message: 'Tables successfully unmerged and split.' };
  }
}
