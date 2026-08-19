import ApiError from '../utils/ApiError';
import type { AppNext, AppRequest, AppResponse } from '../types/http';

interface ApplicationError {
  statusCode?: number;
  message?: string;
  details?: unknown;
}

export const errorHandler = (err: ApplicationError, req: AppRequest, res: AppResponse, next: AppNext): void => {
  let { statusCode, message } = err;

  if (!(err instanceof ApiError)) {
    statusCode = 500;
    message = process.env.NODE_ENV === 'production' ? 'خطأ داخلي في الخادم' : err.message;
  }

  if (process.env.NODE_ENV !== 'test' && statusCode === 500) console.error(err);

  res.status(statusCode || 500).json({
    success: false,
    message: message || 'حدث خطأ غير متوقع',
    details: err.details || undefined,
  });
};

export const notFoundHandler = (req: AppRequest, res: AppResponse, next: AppNext): void => {
  next(new ApiError(404, `المسار غير موجود: ${req.originalUrl}`));
};

module.exports = { errorHandler, notFoundHandler };
