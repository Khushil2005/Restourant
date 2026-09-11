import { KOTTicket } from '../models/KOT';
import { Order } from '../models/Order';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';

export class KOTService {
  static async getActiveKOTs() {
    return KOTTicket.find({
      status: { $in: ['NEW', 'ACCEPTED', 'PREPARING', 'READY'] }
    }).sort({ priority: -1, createdAt: 1 });
  }

  static async getKOTById(id: string) {
    const kot = await KOTTicket.findOne({ id });
    if (!kot) throw { statusCode: 404, message: 'KOT ticket not found.' };
    return kot;
  }

  static async acceptKOT(id: string, userId?: string, username?: string) {
    const kot = await KOTTicket.findOneAndUpdate(
      { id },
      { $set: { status: 'ACCEPTED', acceptedAt: new Date() } },
      { new: true }
    );
    if (kot) {
      SocketEvents.emitKOTUpdated(kot);
      await createAuditLog({
        userId,
        username,
        module: 'Kitchen / KOT',
        action: 'ACCEPT_KOT',
        recordId: id,
        newValue: { status: 'ACCEPTED' }
      });
    }
    return kot;
  }

  static async startPreparing(id: string, userId?: string, username?: string) {
    const kot = await KOTTicket.findOneAndUpdate(
      { id },
      { 
        $set: { 
          status: 'PREPARING', 
          preparingAt: new Date(),
          'items.$[].status': 'PREPARING'
        } 
      },
      { new: true }
    );
    if (kot) {
      SocketEvents.emitKOTUpdated(kot);
      await Order.findOneAndUpdate({ id: kot.orderId }, { $set: { status: 'IN_KITCHEN' } });
    }
    return kot;
  }

  static async markReady(id: string, userId?: string, username?: string) {
    const kot = await KOTTicket.findOneAndUpdate(
      { id },
      { 
        $set: { 
          status: 'READY', 
          readyAt: new Date(),
          'items.$[].status': 'READY'
        } 
      },
      { new: true }
    );
    if (kot) {
      SocketEvents.emitKOTReady(kot);
      SocketEvents.emitKOTUpdated(kot);
      const order = await Order.findOneAndUpdate({ id: kot.orderId }, { $set: { status: 'READY' } }, { new: true });
      if (order) SocketEvents.emitOrderUpdated(order);
    }
    return kot;
  }

  static async markServed(id: string, userId?: string, username?: string) {
    const kot = await KOTTicket.findOneAndUpdate(
      { id },
      { 
        $set: { 
          status: 'SERVED', 
          servedAt: new Date(),
          'items.$[].status': 'SERVED'
        } 
      },
      { new: true }
    );
    if (kot) {
      SocketEvents.emitKOTUpdated(kot);
      const order = await Order.findOneAndUpdate({ id: kot.orderId }, { $set: { status: 'SERVED' } }, { new: true });
      if (order) SocketEvents.emitOrderUpdated(order);
    }
    return kot;
  }

  static async setPriority(id: string, priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') {
    const kot = await KOTTicket.findOneAndUpdate(
      { id },
      { $set: { priority } },
      { new: true }
    );
    if (kot) SocketEvents.emitKOTUpdated(kot);
    return kot;
  }

  static async cancelKOT(id: string, reason?: string, userId?: string, username?: string) {
    const kot = await KOTTicket.findOneAndUpdate(
      { id },
      { $set: { status: 'CANCELLED', chefNotes: reason } },
      { new: true }
    );
    if (kot) SocketEvents.emitKOTUpdated(kot);
    return kot;
  }
}
