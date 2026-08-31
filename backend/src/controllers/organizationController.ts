import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const organizationService = require('../services/organizationService');
export {};

const getOwnSettings = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await organizationService.getOwnOrganization(req.organizationId) }));
const updateSettings = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث إعدادات المؤسسة', data: await organizationService.updateOrganization(req.organizationId, req.body, req.user?.id) }));

const createOrganization = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(201).json({
    success: true,
    message: 'تم إنشاء المؤسسة بنجاح',
    data: await organizationService.createOrganization(req.body, req.user?.id),
  })
);

const listNodes = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({ success: true, data: await organizationService.listOrganizationNodes(req.organizationId) })
);

const createNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(201).json({
    success: true,
    message: 'تم إنشاء الوحدة التنظيمية بنجاح',
    data: await organizationService.createOrganizationNode(req.organizationId, req.body, req.user?.id),
  })
);

const updateNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم تحديث الوحدة التنظيمية بنجاح',
    data: await organizationService.updateOrganizationNode(req.organizationId, req.params.id, req.body, req.user?.id),
  })
);

const deactivateNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم تعطيل الوحدة التنظيمية بنجاح',
    data: await organizationService.deactivateOrganizationNode(req.organizationId, req.params.id, req.user?.id),
  })
);

module.exports = { getOwnSettings, updateSettings, createOrganization, listNodes, createNode, updateNode, deactivateNode };

