import { Router, Response } from 'express';
import { AuthService } from '../services/authService';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorize } from '../middleware/permissionMiddleware';
import { DashboardService } from '../services/dashboardService';
import { ApiResponse } from '../utils/apiResponse';

export const authRouter = Router();

authRouter.post('/login', async (req, res: Response) => {
  try {
    const { username, password, securityKey } = req.body;
    const passToUse = password || securityKey;
    if (!passToUse) {
      return ApiResponse.validationError(res, 'Security key or password is required.');
    }
    const userToUse = username || 'superadmin';
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await AuthService.login(userToUse, passToUse, ip, ua);
    return ApiResponse.success(res, result, 'Login successful.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

authRouter.post('/refresh', async (req, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return ApiResponse.validationError(res, 'Refresh token required.');
    }
    const result = await AuthService.refreshToken(refreshToken);
    return ApiResponse.success(res, result, 'Token refreshed.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 401);
  }
});

authRouter.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AuthService.getProfile(req.user!.userId);
    return ApiResponse.success(res, result, 'Profile retrieved.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 500);
  }
});

authRouter.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return ApiResponse.validationError(res, 'Both current and new password are required.');
    }
    const result = await AuthService.changePassword(req.user!.userId, currentPassword, newPassword);
    return ApiResponse.success(res, result, 'Password changed successfully.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
});

export const dashboardRouter = Router();

dashboardRouter.get('/metrics', authenticate, authorize('dashboard.view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const metrics = await DashboardService.getDashboardMetrics(req.user?.effectivePermissions);
    return ApiResponse.success(res, metrics, 'Dashboard metrics loaded.');
  } catch (err: any) {
    return ApiResponse.error(res, err.message, 500);
  }
});
