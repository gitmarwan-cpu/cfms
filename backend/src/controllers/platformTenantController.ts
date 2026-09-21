import type { AppRequest, AppResponse } from '../types/http';

const catchAsync = require('../utils/catchAsync');
const tenantProvisioningService = require('../services/tenantProvisioningService');
const { transitionTenantLifecycle } = require('../services/tenantLifecycleService');
const platformTenantService = require('../services/platformTenantService');
export {};

const listTenants = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await platformTenantService.listTenants({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    lifecycleStatus: req.query.lifecycleStatus,
  });
  res.status(200).json({ success: true, ...result });
});

const getTenant = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const data = await platformTenantService.getTenant(req.params.organizationId);
  res.status(200).json({ success: true, data });
});

const createTenant = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const data = await tenantProvisioningService.provisionTenant(req.body, req.user?.id);
  res.status(201).json({ success: true, message: 'تم إنشاء المستأجر وتهيئته بنجاح', data });
});

const transitionTenant = (nextStatus: string) => catchAsync(async (req: AppRequest, res: AppResponse) => {
  const lifecycle = await transitionTenantLifecycle(
    req.params.organizationId,
    nextStatus,
    req.user?.id,
    req.body?.reason
  );

  res.status(200).json({
    success: true,
    message: 'تم تحديث دورة حياة المؤسسة بنجاح',
    data: {
      tenantId: lifecycle.id,
      lifecycleStatus: lifecycle.lifecycle_status,
      statusChangedAt: lifecycle.status_changed_at,
      statusChangedByUserId: lifecycle.status_changed_by_user_id,
      statusReason: lifecycle.status_reason,
    },
  });
});

module.exports = { listTenants, getTenant, createTenant, transitionTenant };
