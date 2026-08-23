import { Router, Response } from 'express';
import { OrderService } from '../services/orderService';
import { KOTService } from '../services/kotService';
import { BillingService } from '../services/billingService';
import { PaymentService } from '../services/paymentService';
import { DiscountService } from '../services/discountService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { ApiResponse } from '../utils/apiResponse';

export const orderRouter = Router();

orderRouter.get('/', authenticate, authorize('orders.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await OrderService.getOrders(req.query);
    return ApiResponse.success(res, orders, 'Orders retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

orderRouter.get('/:id', authenticate, authorize('orders.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await OrderService.getOrderById(req.params.id);
    return ApiResponse.success(res, order, 'Order details loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 404);
  }
});

orderRouter.post('/', authenticate, authorize('orders.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await OrderService.createOrder(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Order placed and KOT dispatched.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

orderRouter.post('/:id/items', authenticate, authorize('orders.item_add'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await OrderService.addItemsToOrder(req.params.id, req.body.items, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Items added and running KOT sent.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

orderRouter.patch('/:id/hold', authenticate, authorize('orders.hold'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await OrderService.holdOrder(req.params.id);
    return ApiResponse.success(res, order, 'Order held.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

orderRouter.patch('/:id/resume', authenticate, authorize('orders.resume'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await OrderService.resumeOrder(req.params.id);
    return ApiResponse.success(res, order, 'Order resumed.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

orderRouter.post('/:id/cancel', authenticate, authorize('orders.cancel'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await OrderService.cancelOrder(req.params.id, req.body.reason, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, order, 'Order cancelled.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const kotRouter = Router();

kotRouter.get('/', authenticate, authorize('kot.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kots = await KOTService.getActiveKOTs();
    return ApiResponse.success(res, kots, 'Kitchen display tickets loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

kotRouter.patch('/:id/accept', authenticate, authorize('kot.accept'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kot = await KOTService.acceptKOT(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, kot, 'KOT accepted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

kotRouter.patch('/:id/prepare', authenticate, authorize('kot.prepare'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kot = await KOTService.startPreparing(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, kot, 'KOT in preparation.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

kotRouter.patch('/:id/ready', authenticate, authorize('kot.ready'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kot = await KOTService.markReady(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, kot, 'Food is ready for service.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

kotRouter.patch('/:id/served', authenticate, authorize('kot.served'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kot = await KOTService.markServed(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, kot, 'Food marked as served.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

kotRouter.patch('/:id/priority', authenticate, authorize('kot.priority'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kot = await KOTService.setPriority(req.params.id, req.body.priority);
    return ApiResponse.success(res, kot, 'Priority updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const billingRouter = Router();

billingRouter.get('/', authenticate, authorize('billing.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bills = await BillingService.getBills(req.query);
    return ApiResponse.success(res, bills, 'Bills retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

billingRouter.get('/:id', authenticate, authorize('billing.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bill = await BillingService.getBillById(req.params.id);
    return ApiResponse.success(res, bill, 'Bill loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 404);
  }
});

billingRouter.post('/generate', authenticate, authorize('billing.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bill = await BillingService.generateBillFromOrder(req.body.orderId, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, bill, 'Bill generated.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

billingRouter.post('/:id/apply-discount', authenticate, authorize('discount.apply'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bill = await BillingService.applyDiscount(req.params.id, req.body.discountCode, req.body.approvedBy, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, bill, 'Discount applied.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

billingRouter.post('/:id/split', authenticate, authorize('billing.split'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subBills = await BillingService.splitBill(req.params.id, Number(req.body.splitCount || 2));
    return ApiResponse.success(res, subBills, 'Bill split successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const paymentRouter = Router();

paymentRouter.get('/', authenticate, authorize('payment.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payments = await PaymentService.getPayments(req.query);
    return ApiResponse.success(res, payments, 'Payments retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

paymentRouter.post('/', authenticate, authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await PaymentService.createPayment(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, result, 'Payment recorded and order completed.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

paymentRouter.patch('/:id/verify', authenticate, authorize('payment.verify'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await PaymentService.verifyPayment(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, payment, 'Payment verified.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

paymentRouter.patch('/:id/reconcile', authenticate, authorize('payment.reconcile'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await PaymentService.reconcilePayment(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, payment, 'Payment reconciled.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

paymentRouter.post('/:id/refund', authenticate, authorize('payment.refund'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await PaymentService.refundPayment(req.params.id, req.body.refundAmount, req.body.reason, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, payment, 'Payment refunded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

export const discountRouter = Router();

discountRouter.get('/', authenticate, authorize('discount.view'), async (req, res: Response) => {
  try {
    const rules = await DiscountService.getDiscountRules();
    return ApiResponse.success(res, rules, 'Discount rules loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});

discountRouter.post('/', authenticate, authorize('discount.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await DiscountService.createDiscountRule(req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, rule, 'Discount rule created.', 201);
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

discountRouter.put('/:id', authenticate, authorize('discount.edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await DiscountService.updateDiscountRule(req.params.id, req.body, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, rule, 'Discount rule updated.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 400);
  }
});

discountRouter.delete('/:id', authenticate, authorize('discount.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await DiscountService.deleteDiscountRule(req.params.id, req.user!.userId, req.user!.username);
    return ApiResponse.success(res, null, 'Discount rule deleted.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});
