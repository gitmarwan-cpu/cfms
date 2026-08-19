import type { AppRequest, AppResponse } from '../types/http';

const catchAsync = require('../utils/catchAsync');
const slaService = require('../services/slaService');
export {};

const listSlaRules = catchAsync(async (req: AppRequest, res: AppResponse) => {
  res.status(200).json({ success: true, data: await slaService.listSlaRules(req.organizationId) });
});

const createSlaRule = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const rule = await slaService.createSlaRule(req.organizationId, req.body, req.user!.id);
  res.status(201).json({ success: true, message: 'تم إنشاء قاعدة مهلة المعالجة', data: rule });
});

const updateSlaRule = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const rule = await slaService.updateSlaRule(req.organizationId, req.params.id, req.body, req.user!.id);
  res.status(200).json({ success: true, message: 'تم تحديث قاعدة مهلة المعالجة', data: rule });
});

const evaluateSla = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await slaService.evaluateOrganizationSla(req.organizationId, { actorUserId: req.user!.id });
  res.status(200).json({ success: true, message: 'تم تقييم مهلة المعالجة', data: result });
});

module.exports = { listSlaRules, createSlaRule, updateSlaRule, evaluateSla };
