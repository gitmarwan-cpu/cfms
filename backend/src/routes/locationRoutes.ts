import express from 'express';
import * as locationController from '../controllers/locationController';

const router = express.Router();
router.get('/countries', locationController.getCountries);
router.get('/governorates', locationController.getGovernorates);
router.get('/governorates/:governorateId/districts', locationController.getDistrictsByGovernorate);
router.get('/districts', locationController.getAllDistricts);

export default router;
module.exports = router;
