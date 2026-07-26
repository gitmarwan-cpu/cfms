'use strict';

const express = require('express');
const { resolvePublicTenant } = require('../middlewares/tenant');
const upload = require('../middlewares/upload');
const validate = require('../middlewares/validate');

const organizationService = require('../services/organizationService');
const referenceDataService = require('../services/referenceDataService');
const complaintController = require('../controllers/complaintController');
const {
  createComplaintValidation,
  trackComplaintValidation,
} = require('../validations/complaintValidation');
const { listKeyParamValidation } = require('../validations/referenceDataValidation');
const catchAsync = require('../utils/catchAsync');

/**
 * =====================================================================
 * البوابة العامة (Public Portal) — بلا مصادقة إطلاقاً
 * =====================================================================
 * كل شيء هنا مخصص لمستفيد/مُبلِّغ لا يملك حساباً في النظام أصلاً (بند
 * "سادساً": المستفيدون لا يحتاجون إلى إنشاء حساب). المؤسسة المستهدفة
 * تُحدَّد حصراً عبر :orgSlug في الرابط (resolvePublicTenant)، لا عبر أي
 * حقل في body أو query يرسله العميل.
 *
 * مسار نموذجي: GET/POST /api/public/save-the-children-ye/...
 */
const router = express.Router({ mergeParams: true });

router.use('/:orgSlug', resolvePublicTenant);

// --- الهوية البصرية للمؤسسة (لعرض الشعار/الألوان/الاسم في نموذج الشكوى) ---
router.get(
  '/:orgSlug/organization',
  catchAsync(async (req, res) => {
    const organization = await organizationService.getOwnOrganization(req.organizationId);
    const { id, legalName, shortName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, defaultLanguage } =
      organization;
    res.status(200).json({
      success: true,
      data: { id, legalName, shortName, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, defaultLanguage },
    });
  })
);

// --- البيانات المرجعية (تصنيفات/قنوات/جنس/فئة عمرية) لملء نموذج الشكوى ---
router.get(
  '/:orgSlug/reference-data/:key/items',
  validate(listKeyParamValidation),
  catchAsync(async (req, res) => {
    const items = await referenceDataService.getItemsByListKey(req.params.key, req.organizationId);
    res.status(200).json({ success: true, data: items });
  })
);

// --- تقديم شكوى/مقترح (بلا مصادقة) ---
router.post(
  '/:orgSlug/complaints',
  upload.array('attachments', 3),
  validate(createComplaintValidation),
  complaintController.submitPublicComplaint
);

// --- متابعة شكوى عبر الرقم المرجعي + PIN (بلا تسجيل دخول) ---
router.post(
  '/:orgSlug/complaints/track',
  validate(trackComplaintValidation),
  complaintController.trackPublicComplaint
);

module.exports = router;
