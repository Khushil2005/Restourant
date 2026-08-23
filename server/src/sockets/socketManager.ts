import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';

let ioInstance: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioInstance.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      // Allow anonymous connection for public displays like Token display
      (socket as any).isAnonymous = true;
      return next();
    }

    try {
      const payload = verifyAccessToken(token as string);
      (socket as any).user = payload;
      next();
    } catch (err) {
      (socket as any).isAnonymous = true;
      next();
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: ${socket.id} (${user ? user.username : 'Guest/Display'})`);

    // Join room based on role
    if (user?.roleName) {
      socket.join(`role:${user.roleName}`);
    }

    // Join specific rooms
    socket.on('join_room', (room: string) => {
      socket.join(room);
      logger.debug(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave_room', (room: string) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized yet');
  }
  return ioInstance;
}

// Helper event emitters
export const SocketEvents = {
  emitOrderCreated: (order: any) => {
    ioInstance?.emit('order.created', order);
  },
  emitOrderUpdated: (order: any) => {
    ioInstance?.emit('order.updated', order);
  },
  emitKOTCreated: (kot: any) => {
    ioInstance?.emit('kot.created', kot);
    ioInstance?.to('role:Kitchen Staff').emit('kot.alert', kot);
  },
  emitKOTUpdated: (kot: any) => {
    ioInstance?.emit('kot.updated', kot);
  },
  emitKOTReady: (kot: any) => {
    ioInstance?.emit('kot.ready', kot);
    ioInstance?.to('role:Waiter').to('role:Manager').emit('kot.ready_alert', kot);
  },
  emitTokenCalled: (token: any) => {
    ioInstance?.emit('token.called', token);
  },
  emitTokenUpdated: (token: any) => {
    ioInstance?.emit('token.updated', token);
  },
  emitTableUpdated: (table: any) => {
    ioInstance?.emit('table.updated', table);
  },
  emitPaymentCompleted: (payment: any) => {
    ioInstance?.emit('payment.completed', payment);
  },
  emitLowStockAlert: (item: any) => {
    ioInstance?.emit('inventory.low_stock', item);
  },
  emitNotificationCreated: (notification: any) => {
    ioInstance?.emit('notification.created', notification);
  },
  emitSystemStatusChanged: (statusData: any) => {
    ioInstance?.emit('system.status_changed', statusData);
  },
  emitBookingUpdated: (booking: any) => {
    ioInstance?.emit('booking.updated', booking);
  },
  emitBookingDeleted: (bookingId: string) => {
    ioInstance?.emit('booking.updated', { id: bookingId, deleted: true });
  }
};
