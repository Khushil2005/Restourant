import { Router, Response } from 'express';
import { BookingService } from '../services/bookingService';
import { TokenService } from '../services/tokenService';
import { TableService } from '../services/tableService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const bookingRouter = Router();

bookingRouter.get('/', authenticate, authorize('booking.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookings = await BookingService.getBookings(req.query);
    return ApiResponse.success(res, bookings, 'Bookings retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

bookingRouter.post('/', authenticate, authorize('booking.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await BookingService.createBooking(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, booking, 'Booking created successfully.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

bookingRouter.patch('/:id/status', authenticate, authorize(['booking.confirm', 'booking.cancel', 'booking.checkin', 'booking.edit']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await BookingService.updateBookingStatus(req.params.id, req.body.status, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, booking, `Booking marked as ${req.body.status}`);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

bookingRouter.patch('/:id/assign-table', authenticate, authorize('booking.assign_table'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await BookingService.assignTable(req.params.id, req.body.tableId, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, booking, 'Table assigned to booking.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

bookingRouter.delete('/:id', authenticate, authorize(['booking.delete', 'booking.cancel', 'booking.edit']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BookingService.deleteBooking(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Function date unlocked.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const tokenRouter = Router();

// Allow public access to token queue display if needed
tokenRouter.get('/queue', async (req, res: Response) => {
  try {
    const queue = await TokenService.getQueue(req.query.status as string);
    return ApiResponse.success(res, queue, 'Live queue retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

tokenRouter.post('/', authenticate, authorize('token.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await TokenService.generateToken(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, token, 'Token generated.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

tokenRouter.patch('/:id/call', authenticate, authorize('token.call'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await TokenService.callToken(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, token, 'Token called.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

tokenRouter.patch('/:id/recall', authenticate, authorize('token.recall'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await TokenService.recallToken(req.params.id);
    return ApiResponse.success(res, token, 'Token recalled.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

tokenRouter.patch('/:id/skip', authenticate, authorize('token.skip'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await TokenService.skipToken(req.params.id);
    return ApiResponse.success(res, token, 'Token skipped.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

tokenRouter.patch('/:id/seat', authenticate, authorize('token.seat'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await TokenService.seatToken(req.params.id, req.body.tableId);
    return ApiResponse.success(res, token, 'Guest seated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const tableRouter = Router();

tableRouter.get('/floor-layout', authenticate, authorize('tables.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const layout = await TableService.getFloorLayout();
    return ApiResponse.success(res, layout, 'Floor layout loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

tableRouter.patch('/:id/status', authenticate, authorize('tables.status'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const table = await TableService.updateStatus(req.params.id, req.body.status, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, table, 'Table status updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

tableRouter.post('/transfer', authenticate, authorize('tables.transfer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await TableService.transferTable(req.body.sourceTableId, req.body.destTableId, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

tableRouter.post('/merge', authenticate, authorize('tables.merge'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await TableService.mergeTables(req.body.primaryTableId, req.body.secondaryTableIds);
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

tableRouter.post('/split', authenticate, authorize('tables.split'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await TableService.splitTables(req.body.tableIds);
    return ApiResponse.success(res, result, result.message);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});
