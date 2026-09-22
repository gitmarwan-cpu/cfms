import type { AppRequest, AppResponse } from '../types/http';

import catchAsync from '../utils/catchAsync';
import { getComplaintSummary } from '../services/reportService';

const complaintSummary = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const report = await getComplaintSummary(req.organizationId!, {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  });
  res.status(200).json({ success: true, data: report });
});

export { complaintSummary };
