import { QueueToken } from '../models/QueueToken';
import { DiningTable } from '../models/Master';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class TokenService {
  /**
   * Drops legacy unique index on tokenCode if it still exists in the collection.
   */
  private static async ensureIndexCleanliness() {
    try {
      await QueueToken.collection.dropIndex('tokenCode_1');
    } catch (_) {
      // Index already dropped or doesn't exist; safe to ignore
    }
  }

  /**
   * Retrieves the queue tokens for a specific date (or today by default) with optional status filtering.
   */
  static async getQueue(status?: string, date?: string) {
    await this.ensureIndexCleanliness();

    const filter: any = {};
    if (status && status !== 'ALL') {
      if (status === 'CALLING') {
        filter.status = { $in: ['CALLED', 'RECALLED'] };
      } else if (status === 'SERVED') {
        filter.status = { $in: ['SEATED', 'COMPLETED'] };
      } else {
        filter.status = status;
      }
    }

    if (date && date !== 'ALL') {
      // Specific date requested (e.g. "2026-09-14")
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      filter.$or = [
        { tokenDate: date },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } }
      ];
    } else if (!date) {
      // Default to today's date in local ISO date format
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      filter.$or = [
        { tokenDate: todayStr },
        { createdAt: { $gte: startOfToday } }
      ];
    }

    return QueueToken.find(filter).sort({ tokenNumber: 1, createdAt: 1 });
  }

  /**
   * Returns daily token statistics for a specified date (or today).
   */
  static async getTokenMetrics(date?: string) {
    const queue = await this.getQueue('ALL', date);
    const total = queue.length;
    const waiting = queue.filter(t => t.status === 'WAITING').length;
    const calling = queue.filter(t => t.status === 'CALLED' || t.status === 'RECALLED').length;
    const seated = queue.filter(t => t.status === 'SEATED' || t.status === 'COMPLETED').length;
    const cancelled = queue.filter(t => t.status === 'CANCELLED' || t.status === 'SKIPPED').length;

    // Calculate average wait time for seated/completed tokens
    let totalWaitMs = 0;
    let waitCount = 0;
    queue.forEach(t => {
      if (t.seatedAt && t.createdAt) {
        const waitMs = new Date(t.seatedAt).getTime() - new Date(t.createdAt).getTime();
        if (waitMs > 0) {
          totalWaitMs += waitMs;
          waitCount++;
        }
      }
    });

    const avgWaitMinutes = waitCount > 0 ? Math.round((totalWaitMs / waitCount) / 60000) : 0;

    return {
      date: date || new Date().toISOString().split('T')[0],
      total,
      waiting,
      calling,
      seated,
      cancelled,
      avgWaitMinutes
    };
  }

  /**
   * Generates a new token sequenced daily (T-1, T-2...) without duplicate key collisions.
   */
  static async generateToken(data: any, userId?: string, username?: string) {
    await this.ensureIndexCleanliness();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tokenDate = data.tokenDate || todayStr;

    // Find the latest token issued on this exact date to get next sequential tokenNumber
    const latestTokenOnDate = await QueueToken.findOne({
      $or: [
        { tokenDate },
        { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      ]
    }).sort({ tokenNumber: -1 });

    const tokenNumber = (latestTokenOnDate?.tokenNumber || 0) + 1;
    const tokenCode = `T-${tokenNumber}`;
    const id = `tok_${uuidv4().slice(0, 8)}`;

    const token = await QueueToken.create({
      ...data,
      id,
      tokenDate,
      tokenNumber,
      tokenCode,
      status: 'WAITING'
    });

    SocketEvents.emitTokenUpdated(token);
    await createAuditLog({
      userId,
      username,
      module: 'Token & Queue',
      submodule: 'Queue',
      action: 'GENERATE',
      recordId: id,
      newValue: token
    });

    return token;
  }

  static async callToken(id: string, userId?: string, username?: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'CALLED', calledAt: new Date() } },
      { new: true }
    );
    if (token) {
      SocketEvents.emitTokenCalled(token);
      SocketEvents.emitTokenUpdated(token);
    }
    return token;
  }

  static async recallToken(id: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'RECALLED', calledAt: new Date() } },
      { new: true }
    );
    if (token) {
      SocketEvents.emitTokenCalled(token);
      SocketEvents.emitTokenUpdated(token);
    }
    return token;
  }

  static async skipToken(id: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'SKIPPED' } },
      { new: true }
    );
    if (token) SocketEvents.emitTokenUpdated(token);
    return token;
  }

  static async seatToken(id: string, tableId: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'SEATED', tableId, seatedAt: new Date() } },
      { new: true }
    );

    if (tableId) {
      await DiningTable.findOneAndUpdate({ id: tableId }, { $set: { status: 'OCCUPIED' } });
      SocketEvents.emitTableUpdated({ tableId, status: 'OCCUPIED' });
    }

    if (token) SocketEvents.emitTokenUpdated(token);
    return token;
  }

  static async completeToken(id: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'COMPLETED', completedAt: new Date() } },
      { new: true }
    );
    if (token) SocketEvents.emitTokenUpdated(token);
    return token;
  }

  static async cancelToken(id: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'CANCELLED', cancelledAt: new Date() } },
      { new: true }
    );
    if (token) SocketEvents.emitTokenUpdated(token);
    return token;
  }
}
