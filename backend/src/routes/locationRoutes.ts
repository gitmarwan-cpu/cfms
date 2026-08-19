const express = require('express');
const locationController = require('../controllers/locationController');
export {};

const router = express.Router();
router.get('/governorates', locationController.getGovernorates);
router.get('/governorates/:governorateId/districts', locationController.getDistrictsByGovernorate);
router.get('/districts', locationController.getAllDistricts);

module.exports = router;
