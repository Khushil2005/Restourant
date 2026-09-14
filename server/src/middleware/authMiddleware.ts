import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { ApiResponse } from '../utils/apiResponse';
import { User } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload & { effectivePermissions?: Set<string> };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Authentication token required.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await User.findOne({ id: payload.userId });

    if (!user || user.status !== 'ACTIVE') {
      return ApiResponse.error(res, 'User account is inactive or suspended.', 401, 'ACCOUNT_INACTIVE');
    }

    req.user = payload;
    next();
  } catch (err: any) {
    return ApiResponse.error(res, 'Invalid or expired session token.', 401, 'TOKEN_EXPIRED');
  }
}
