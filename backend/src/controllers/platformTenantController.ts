import type { AppRequest, AppResponse } from '../types/http';

import catchAsync from '../utils/catchAsync';
import * as tenantProvisioningService from '../services/tenantProvisioningService';
import { transitionTenantLifecycle } from '../services/tenantLifecycleService';
import type { LifecycleStatus } from '../services/tenantLifecycleService';
import * as platformTenantService from '../services/platformTenantService';
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
  const data = await tenantProvisioningService.provisionTenant(req.body, req.user!.id);
  res.status(201).json({ success: true, message: 'تم إنشاء المستأجر وتهيئته بنجاح', data });
});

const transitionTenant = (nextStatus: LifecycleStatus) => catchAsync(async (req: AppRequest, res: AppResponse) => {
  const lifecycle = await transitionTenantLifecycle(
    req.params.organizationId,
    nextStatus,
    req.user!.id,
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

export { listTenants, getTenant, createTenant, transitionTenant };
