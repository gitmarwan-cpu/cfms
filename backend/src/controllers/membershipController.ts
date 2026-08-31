import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const membershipService = require('../services/membershipService');
export {};

/**
 * HTTP translation layer for membership lifecycle management (Phase 3).
 * All business rules live in services/membershipService.ts.
 *
 * SECURITY: the tenant discriminator is ALWAYS req.organizationId — it is
 * never read from params, body, or query.
 */

const listMemberships = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({ success: true, data: await membershipService.listMemberships(req.organizationId, req.params.userId) })
);

const addMembership = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(201).json({
    success: true,
    message: 'تمت إضافة العضوية بنجاح',
    data: await membershipService.addMembership(req.organizationId, req.user?.id ?? null, req.params.userId),
  })
);

const removeMembership = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم إلغاء العضوية بنجاح',
    data: await membershipService.removeMembership(req.organizationId, req.user?.id ?? null, req.params.membershipId),
  })
);

const setPrimaryMembership = catchAsync(async (req: AppRequest, res: AppResponse) =>
  res.status(200).json({
    success: true,
    message: 'تم تعيين العضوية الأساسية بنجاح',
    data: await membershipService.setPrimaryMembership(req.organizationId, req.user?.id ?? null, req.params.membershipId),
  })
);

module.exports = { listMemberships, addMembership, removeMembership, setPrimaryMembership };
