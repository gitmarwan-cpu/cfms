import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import * as platformSettingsService from '../services/platformSettingsService';
import * as emailService from '../services/emailService';

const getEmailSettings = catchAsync(async (_req: AppRequest, res: AppResponse) => {
  const settings = await platformSettingsService.getEmailSettings();
  res.status(200).json({ success: true, data: settings });
});

const updateEmailSettings = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const updated = await platformSettingsService.updateEmailSettings(req.body, req.user?.id);
  res.status(200).json({
    success: true,
    message: 'تم حفظ إعدادات البريد الإلكتروني بنجاح',
    data: updated,
  });
});

const testEmailSettings = catchAsync(async (req: AppRequest, res: AppResponse) => {
  // Phase 2: Validates configuration on-demand without sending email or establishing network connections
  const result = await emailService.testEmailConnection(req.user?.email || '');
  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export { getEmailSettings, updateEmailSettings, testEmailSettings };
