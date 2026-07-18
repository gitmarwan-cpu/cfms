'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * يشغّل قواعد express-validator المُمررة، وإذا وُجدت أخطاء
 * يرجعها بصيغة موحدة 422 بدلاً من ترك كل كنترولر يتحقق بنفسه.
 */
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((validation) => validation.run(req)));

  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'بيانات غير صالحة', details));
};

module.exports = validate;
