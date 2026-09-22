import express from 'express';
import { resolvePublicTenant } from '../middlewares/tenant';
import upload, { validateUploadedFileSignatures } from '../middlewares/upload';
import validate from '../middlewares/validate';
import { getOwnOrganization } from '../services/organizationService';
import { getItemsByListKey } from '../services/referenceDataService';
import * as complaintController from '../controllers/complaintController';
import { createComplaintValidation, trackComplaintValidation } from '../validations/complaintValidation';
import { listKeyParamValidation } from '../validations/referenceDataValidation';
import { submitComplaintRateLimiter, trackComplaintRateLimiter } from '../middlewares/rateLimiter';
import catchAsync from '../utils/catchAsync';
import type { AppRequest, AppResponse } from '../types/http';

const router = express.Router({ mergeParams: true });
router.use('/:orgSlug', resolvePublicTenant);
router.get('/:orgSlug/organization', catchAsync(async (req: AppRequest, res: AppResponse) => {
  const organization = await getOwnOrganization(req.organizationId!);
  const { id, legalName, shortName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, defaultLanguage } = organization;
  res.status(200).json({ success: true, data: { id, legalName, shortName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, defaultLanguage } });
}));
router.get('/:orgSlug/reference-data/:key/items', validate(listKeyParamValidation), catchAsync(async (req: AppRequest, res: AppResponse) => {
  const items = await getItemsByListKey(req.params.key, req.organizationId!);
  res.status(200).json({ success: true, data: items });
}));
router.post('/:orgSlug/complaints', submitComplaintRateLimiter, upload.array('attachments', 3), validateUploadedFileSignatures, validate(createComplaintValidation), complaintController.submitPublicComplaint);
router.post('/:orgSlug/complaints/track', trackComplaintRateLimiter, validate(trackComplaintValidation), complaintController.trackPublicComplaint);

export default router;
