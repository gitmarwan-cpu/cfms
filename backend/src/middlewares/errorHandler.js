'use strict';

const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (!(err instanceof ApiError)) {
    statusCode = 500;
    message = process.env.NODE_ENV === 'production' ? 'خطأ داخلي في الخادم' : err.message;
  }

  if (process.env.NODE_ENV !== 'test' && statusCode === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode || 500).json({
    success: false,
    message: message || 'حدث خطأ غير متوقع',
    details: err.details || undefined,
  });
};

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `المسار غير موجود: ${req.originalUrl}`));
};

module.exports = { errorHandler, notFoundHandler };
