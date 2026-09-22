import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import * as organizationService from '../services/organizationService';
const getOwnSettings = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await organizationService.getOwnOrganization(req.organizationId!) }));
const updateSettings = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث إعدادات المؤسسة', data: await organizationService.updateOrganization(req.organizationId!, req.body, req.user?.id) }));

const listNodes = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({ success: true, data: await organizationService.listOrganizationNodes(req.organizationId!) })
);

const createNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(201).json({
    success: true,
    message: 'تم إنشاء الوحدة التنظيمية بنجاح',
    data: await organizationService.createOrganizationNode(req.organizationId!, req.body, req.user?.id),
  })
);

const updateNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم تحديث الوحدة التنظيمية بنجاح',
    data: await organizationService.updateOrganizationNode(req.organizationId!, req.params.id, req.body, req.user?.id),
  })
);

const deactivateNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم تعطيل الوحدة التنظيمية بنجاح',
    data: await organizationService.deactivateOrganizationNode(req.organizationId!, req.params.id, req.user?.id),
  })
);

const activateNode = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم تفعيل الوحدة التنظيمية بنجاح',
    data: await organizationService.reactivateOrganizationNode(req.organizationId!, req.params.id, req.user?.id),
  })
);

export { getOwnSettings, updateSettings, listNodes, createNode, updateNode, deactivateNode, activateNode };
