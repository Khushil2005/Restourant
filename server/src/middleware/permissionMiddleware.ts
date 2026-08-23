import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { ApiResponse } from '../utils/apiResponse';
import { Role, Permission } from '../models/Role';
import { User } from '../models/User';
import { ALL_PERMISSIONS } from '../constants/permissions';

export interface PermissionDetails {
  permissionId: string;
  source: 'SYSTEM' | 'ROLE' | 'USER_OVERRIDE_ALLOW' | 'USER_OVERRIDE_DENY';
  granted: boolean;
}

/**
 * Calculates effective permissions for a user taking into account:
 * 1. Role-assigned permissions
 * 2. User-specific overrides (ALLOW, DENY, INHERIT)
 */
export async function calculateEffectivePermissions(userId: string, roleId: string): Promise<Map<string, PermissionDetails>> {
  const result = new Map<string, PermissionDetails>();

  // Fetch Role
  let role: any = null;
  try {
    role = await Role.findOne({ id: roleId });
  } catch (_) {}

  const isSuperAdmin = 
    role?.name === 'Super Admin' || 
    role?.name === 'Admin' ||
    roleId === 'role_super_admin' || 
    roleId === 'role_admin' ||
    roleId === 'superadmin' ||
    roleId === 'admin';

  const rolePerms = new Set<string>(role?.permissions || []);

  // Fetch User Overrides
  let user: any = null;
  try {
    user = await User.findOne({ $or: [{ id: userId }, { username: userId }] });
  } catch (_) {}

  const overrideMap = new Map<string, string>();
  if (user && user.permissionOverrides) {
    for (const ov of user.permissionOverrides) {
      overrideMap.set(ov.permissionId, ov.overrideType);
    }
  }

  // Get all permission IDs from DB or fallback to ALL_PERMISSIONS constant
  let allPerms: Array<{ id: string }> = [];
  try {
    allPerms = await Permission.find({}, { id: 1 }).lean() as any;
  } catch (_) {}

  const permList = (allPerms && allPerms.length > 0) ? allPerms : ALL_PERMISSIONS;

  for (const perm of permList) {
    const permId = (perm as any).id || (perm as any)._doc?.id;
    const override = overrideMap.get(permId);

    if (override === 'DENY') {
      result.set(permId, {
        permissionId: permId,
        source: 'USER_OVERRIDE_DENY',
        granted: false
      });
    } else if (override === 'ALLOW') {
      result.set(permId, {
        permissionId: permId,
        source: 'USER_OVERRIDE_ALLOW',
        granted: true
      });
    } else {
      // INHERIT or no override
      if (isSuperAdmin) {
        result.set(permId, {
          permissionId: permId,
          source: 'SYSTEM',
          granted: true
        });
      } else {
        const hasRole = rolePerms.has(permId);
        result.set(permId, {
          permissionId: permId,
          source: 'ROLE',
          granted: hasRole
        });
      }
    }
  }

  return result;
}

/**
 * Reusable permission middleware to guard API routes
 */
export function authorize(requiredPermission: string | string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return ApiResponse.forbidden(res, 'Authentication required.');
      }

      const { userId, roleId } = req.user;
      const permMap = await calculateEffectivePermissions(userId, roleId);

      const permsToCheck = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
      const hasPermission = permsToCheck.some(p => permMap.get(p)?.granted === true);

      if (!hasPermission) {
        return ApiResponse.forbidden(
          res,
          `You do not have permission to perform this action. Required: ${permsToCheck.join(' or ')}`
        );
      }

      // Attach granted permissions set for fast in-controller checks if needed
      req.user.effectivePermissions = new Set(
        Array.from(permMap.entries())
          .filter(([_, v]) => v.granted)
          .map(([k]) => k)
      );

      next();
    } catch (err: any) {
      console.error('[Authorize Middleware Error]:', err);
      return ApiResponse.error(res, 'Authorization check failed.', 500);
    }
  };
}
