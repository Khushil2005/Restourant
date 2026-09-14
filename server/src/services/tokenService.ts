import { QueueToken } from '../models/QueueToken';
import { DiningTable } from '../models/Master';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class TokenService {
  static async getQueue(status?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    return QueueToken.find(filter).sort({ tokenNumber: 1 });
  }

  static async generateToken(data: any, userId?: string, username?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await QueueToken.countDocuments({ createdAt: { $gte: today } });
    const tokenNumber = count + 1;
    const tokenCode = `T-${tokenNumber}`;
    const id = `tok_${uuidv4().slice(0, 8)}`;

    const token = await QueueToken.create({
      ...data,
      id,
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
      { $set: { status: 'COMPLETED' } },
      { new: true }
    );
    if (token) SocketEvents.emitTokenUpdated(token);
    return token;
  }

  static async cancelToken(id: string) {
    const token = await QueueToken.findOneAndUpdate(
      { id },
      { $set: { status: 'CANCELLED' } },
      { new: true }
    );
    if (token) SocketEvents.emitTokenUpdated(token);
    return token;
  }
}
