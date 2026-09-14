import { Response } from 'express';

export class ApiResponse {
  static success<T = any>(res: Response, data: T, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static error(res: Response, message: string = 'Internal Server Error', statusCode: number = 500, code?: string) {
    return res.status(statusCode).json({
      success: false,
      message,
      code: code || (statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 404 ? 'NOT_FOUND' : 'SERVER_ERROR')
    });
  }

  static forbidden(res: Response, message: string = 'You do not have permission to perform this action.') {
    return res.status(403).json({
      success: false,
      message,
      code: 'FORBIDDEN'
    });
  }

  static validationError(res: Response, errors: Record<string, any> | string, message: string = 'Validation failed') {
    return res.status(422).json({
      success: false,
      message,
      errors: typeof errors === 'string' ? { general: errors } : errors
    });
  }
}
