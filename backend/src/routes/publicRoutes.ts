const express = require('express');
const { resolvePublicTenant } = require('../middlewares/tenant');
const upload = require('../middlewares/upload');
const { validateUploadedFileSignatures } = require('../middlewares/upload');
const validate = require('../middlewares/validate');
const organizationService = require('../services/organizationService');
const referenceDataService = require('../services/referenceDataService');
const complaintController = require('../controllers/complaintController');
const { createComplaintValidation, trackComplaintValidation } = require('../validations/complaintValidation');
const { listKeyParamValidation } = require('../validations/referenceDataValidation');
const { submitComplaintRateLimiter, trackComplaintRateLimiter } = require('../middlewares/rateLimiter');
const catchAsync = require('../utils/catchAsync');
export {};

const router = express.Router({ mergeParams: true });
router.use('/:orgSlug', resolvePublicTenant);
router.get('/:orgSlug/organization', catchAsync(async (req: any, res: any) => {
  const organization = await organizationService.getOwnOrganization(req.organizationId);
  const { id, legalName, shortName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, defaultLanguage } = organization;
  res.status(200).json({ success: true, data: { id, legalName, shortName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, defaultLanguage } });
}));
router.get('/:orgSlug/reference-data/:key/items', validate(listKeyParamValidation), catchAsync(async (req: any, res: any) => {
  const items = await referenceDataService.getItemsByListKey(req.params.key, req.organizationId);
  res.status(200).json({ success: true, data: items });
}));
router.post('/:orgSlug/complaints', submitComplaintRateLimiter, upload.array('attachments', 3), validateUploadedFileSignatures, validate(createComplaintValidation), complaintController.submitPublicComplaint);
router.post('/:orgSlug/complaints/track', trackComplaintRateLimiter, validate(trackComplaintValidation), complaintController.trackPublicComplaint);

module.exports = router;
