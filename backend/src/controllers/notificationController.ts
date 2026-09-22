import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import { listNotifications, markNotificationRead } from '../services/notificationService';

const list = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await listNotifications(req.user!.id, req.organizationId!, req.query);
  res.status(200).json({ success: true, ...result });
});

const markRead = catchAsync(async (req: AppRequest, res: AppResponse) => {
  await markNotificationRead(req.user!.id, req.organizationId!, req.params.id);
  res.status(200).json({ success: true });
});

export { list, markRead };
