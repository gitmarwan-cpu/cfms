import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
import { listAuditLogs } from '../services/auditService';

const list = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await listAuditLogs(req.organizationId!, req.query);
  res.status(200).json({ success: true, ...result });
});

module.exports = { list };
