'use strict';

const express = require('express');
const locationController = require('../controllers/locationController');

const router = express.Router();

/**
 * GET /api/locations/governorates
 * إرجاع جميع المحافظات (نشطة فقط) بالاسمين العربي والإنجليزي
 */
router.get('/governorates', locationController.getGovernorates);

/**
 * GET /api/locations/governorates/:governorateId/districts
 * إرجاع مديريات محافظة محددة - يُستخدم لتعبئة القائمة المنسدلة
 * الثانية بعد اختيار المحافظة في الواجهة الأمامية
 */
router.get('/governorates/:governorateId/districts', locationController.getDistrictsByGovernorate);

/**
 * GET /api/locations/districts
 * إرجاع كل المديريات مع محافظاتها (لأغراض الإدارة/التقارير)
 */
router.get('/districts', locationController.getAllDistricts);

module.exports = router;
