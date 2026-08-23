import { Booking } from '../models/Booking';
import { DiningTable } from '../models/Master';
import { SocketEvents } from '../sockets/socketManager';
import { createAuditLog } from '../middleware/auditMiddleware';
import { v4 as uuidv4 } from 'uuid';

export class BookingService {
  static async getBookings(query: any = {}) {
    const filter: any = {};
    if (query.date) filter.bookingDate = query.date;
    if (query.month) filter.bookingDate = { $regex: `^${query.month}` };
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { customerName: { $regex: query.search, $options: 'i' } },
        { customerPhone: { $regex: query.search, $options: 'i' } },
        { bookingNumber: { $regex: query.search, $options: 'i' } },
        { functionType: { $regex: query.search, $options: 'i' } },
        { acceptedBy: { $regex: query.search, $options: 'i' } }
      ];
    }
    return Booking.find(filter).sort({ bookingDate: 1, bookingTime: 1 });
  }

  static async createBooking(data: any, userId?: string, username?: string) {
    // 0. Prevent Booking Past Dates: Only today and forward dates allowed
    const todayStr = new Date().toISOString().split('T')[0];
    if (data.bookingDate && data.bookingDate < todayStr) {
      throw {
        statusCode: 400,
        message: 'Cannot book functions for past dates. Please select today or a future calendar date.'
      };
    }

    // 1. Check Date Exclusivity Lock: If locking a function date, check if date is already locked
    if (data.bookingDate) {
      const existingDateBooking = await Booking.findOne({
        bookingDate: data.bookingDate,
        status: { $in: ['CONFIRMED', 'LOCKED', 'CHECKED_IN'] }
      });
      if (existingDateBooking) {
        throw { 
          statusCode: 400, 
          message: `Date ${data.bookingDate} is already exclusively locked for ${existingDateBooking.customerName} (${existingDateBooking.functionType || 'Function'}).` 
        };
      }
    }

    // 2. Table Conflict Check (if table is specified)
    if (data.tableId) {
      const existing = await Booking.findOne({
        tableId: data.tableId,
        bookingDate: data.bookingDate,
        bookingTime: data.bookingTime || '19:00',
        status: { $in: ['CONFIRMED', 'LOCKED', 'CHECKED_IN'] }
      });
      if (existing) {
        throw { statusCode: 400, message: 'This table is already booked for the selected date and time.' };
      }

      // Check table status
      const table = await DiningTable.findOne({ id: data.tableId });
      if (table && table.status === 'MAINTENANCE') {
        throw { statusCode: 400, message: 'Selected table is currently under maintenance.' };
      }
    }

    const id = `fn_${uuidv4().slice(0, 8)}`;
    const count = await Booking.countDocuments();
    const bookingNumber = `FN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const booking = await Booking.create({
      id,
      bookingNumber,
      customerName: data.customerName || data.clientName,
      customerPhone: data.customerPhone || data.phone,
      guestCount: Number(data.guestCount || data.guests || 2),
      advanceAmount: Number(data.advanceAmount || data.advance || 0),
      functionType: data.functionType || data.type || 'Family Dinner',
      acceptedBy: data.acceptedBy || username || 'Manager',
      notes: data.notes || data.specialRequests || '',
      specialRequests: data.notes || data.specialRequests || '',
      bookingDate: data.bookingDate,
      bookingTime: data.bookingTime || '19:00',
      tableId: data.tableId || undefined,
      status: data.status || 'CONFIRMED',
      isLocked: true,
      createdBy: userId
    });

    if (data.tableId) {
      await DiningTable.findOneAndUpdate({ id: data.tableId }, { $set: { status: 'RESERVED' } });
      SocketEvents.emitTableUpdated({ tableId: data.tableId, status: 'RESERVED' });
    }

    SocketEvents.emitBookingUpdated(booking);

    await createAuditLog({
      userId,
      username,
      module: 'Functions',
      submodule: 'Function Locker',
      action: 'LOCK_DATE',
      recordId: id,
      newValue: booking
    });

    return booking;
  }

  static async updateBookingStatus(id: string, status: string, userId?: string, username?: string) {
    const booking = await Booking.findOne({ $or: [{ id }, { _id: id }] });
    if (!booking) throw { statusCode: 404, message: 'Function booking not found.' };

    const oldStatus = booking.status;
    booking.status = status as any;
    if (status === 'CANCELLED') {
      booking.isLocked = false;
    }
    await booking.save();

    // Table state updates based on booking status
    if (booking.tableId) {
      if (status === 'CHECKED_IN') {
        await DiningTable.findOneAndUpdate({ id: booking.tableId }, { $set: { status: 'OCCUPIED' } });
        SocketEvents.emitTableUpdated({ tableId: booking.tableId, status: 'OCCUPIED' });
      } else if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'COMPLETED') {
        await DiningTable.findOneAndUpdate({ id: booking.tableId }, { $set: { status: 'AVAILABLE' } });
        SocketEvents.emitTableUpdated({ tableId: booking.tableId, status: 'AVAILABLE' });
      }
    }

    SocketEvents.emitBookingUpdated(booking);

    await createAuditLog({
      userId,
      username,
      module: 'Functions',
      submodule: 'Function Locker',
      action: `STATUS_${status}`,
      recordId: id,
      oldValue: { status: oldStatus },
      newValue: { status }
    });

    return booking;
  }

  static async deleteBooking(id: string, userId?: string, username?: string) {
    const booking = await Booking.findOne({ $or: [{ id }, { _id: id }] });
    if (!booking) throw { statusCode: 404, message: 'Function booking not found.' };

    if (booking.tableId) {
      await DiningTable.findOneAndUpdate({ id: booking.tableId }, { $set: { status: 'AVAILABLE' } });
      SocketEvents.emitTableUpdated({ tableId: booking.tableId, status: 'AVAILABLE' });
    }

    await Booking.deleteOne({ _id: booking._id });
    SocketEvents.emitBookingDeleted(id);

    await createAuditLog({
      userId,
      username,
      module: 'Functions',
      submodule: 'Function Locker',
      action: 'UNLOCK_DATE',
      recordId: id,
      oldValue: booking
    });

    return { message: 'Function date unlocked successfully.' };
  }

  static async assignTable(bookingId: string, tableId: string, userId?: string, username?: string) {
    const table = await DiningTable.findOne({ id: tableId });
    if (!table || table.status === 'OCCUPIED' || table.status === 'MAINTENANCE') {
      throw { statusCode: 400, message: 'Selected table is not available for assignment.' };
    }

    const booking = await Booking.findOneAndUpdate(
      { id: bookingId },
      { $set: { tableId, status: 'CONFIRMED' } },
      { new: true }
    );

    await DiningTable.findOneAndUpdate({ id: tableId }, { $set: { status: 'RESERVED' } });
    SocketEvents.emitTableUpdated({ tableId, status: 'RESERVED' });

    return booking;
  }
}
