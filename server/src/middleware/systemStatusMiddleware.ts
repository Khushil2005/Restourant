import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { SystemSetting } from '../models/System';
import { ApiResponse } from '../utils/apiResponse';
import { verifyAccessToken } from '../utils/jwt';

export async function systemStatusGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const url = req.originalUrl || req.url || '';

    // Always bypass health checks, auth endpoints, static uploads, and system control status switchboard
    if (
      url === '/health' ||
      url.startsWith('/api/auth') ||
      url.startsWith('/api/system/system-control') ||
      url.startsWith('/uploads')
    ) {
      return next();
    }

    const setting = await SystemSetting.findOne({ key: 'system_status' });
    const status = setting?.value || 'ONLINE';

    // If ONLINE, proceed immediately
    if (status === 'ONLINE') {
      return next();
    }

    // Attempt token verification if user info not already attached
    let userRole = req.user?.roleName || req.user?.roleId;
    if (!userRole) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded: any = verifyAccessToken(token);
          userRole = decoded.roleId || decoded.roleName;
          req.user = decoded;
        } catch (_) {
          // Token invalid or expired, continue check
        }
      }
    }

    // Super Admin & System Admin bypass all maintenance/lockdown restrictions
    if (
      userRole === 'Super Admin' ||
      userRole === 'role_super_admin' ||
      userRole === 'System Admin' ||
      userRole === 'System Administrator' ||
      userRole === 'Admin' ||
      userRole === 'role_admin' ||
      userRole === 'role_system_admin' ||
      req.user?.username === 'superadmin' ||
      req.user?.username === 'admin'
    ) {
      return next();
    }

    if (status === 'EMERGENCY_LOCKDOWN') {
      return ApiResponse.error(
        res,
        'System is currently under EMERGENCY LOCKDOWN by system administration.',
        503,
        'SYSTEM_LOCKDOWN'
      );
    }

    if (status === 'MAINTENANCE' || status === 'SYSTEM_DOWN') {
      return ApiResponse.error(
        res,
        'System is currently undergoing scheduled maintenance. Please try again shortly.',
        503,
        'SYSTEM_MAINTENANCE'
      );
    }

    if (status === 'READ_ONLY' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return ApiResponse.error(
        res,
        'System is temporarily in READ-ONLY mode. Modifications are currently blocked.',
        503,
        'READ_ONLY_MODE'
      );
    }

    next();
  } catch (err) {
    console.error('[System Status Middleware Error]:', err);
    next();
  }
}
