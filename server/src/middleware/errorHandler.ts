import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled Application Error:', err);

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 'Invalid authentication token.', 401, 'UNAUTHORIZED');
  }

  if (err.name === 'ValidationError') {
    return ApiResponse.validationError(res, err.errors || err.message);
  }

  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred. Please try again later.' 
    : err.message || 'Internal Server Error';

  return ApiResponse.error(res, message, err.statusCode || 500, err.code || 'SERVER_ERROR');
}
