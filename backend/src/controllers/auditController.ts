import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import { listAuditLogs, listPlatformAuditLogs } from '../services/auditService';

const list = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await listAuditLogs(req.organizationId!, req.query);
  res.status(200).json({ success: true, ...result });
});

const listPlatform = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await listPlatformAuditLogs(req.query);
  res.status(200).json({ success: true, ...result });
});

export { list, listPlatform };
