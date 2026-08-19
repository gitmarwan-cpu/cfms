import ApiError from '../utils/ApiError';
import type { AppNext, AppRequest, AppResponse } from '../types/http';

const { validationResult } = require('express-validator');

const validate = (validations: any[]) => async (req: AppRequest, res: AppResponse, next: AppNext): Promise<void> => {
  await Promise.all(validations.map((validation) => validation.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
    return;
  }
  const details = errors.array().map((e: any) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'بيانات غير صالحة', details));
};

export default validate;
module.exports = validate;
