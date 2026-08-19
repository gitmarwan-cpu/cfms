const express = require('express');
const orgUnitController = require('../controllers/orgUnitController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { typeIdParamValidation, unitIdParamValidation, createTypeValidation, updateTypeValidation, createUnitValidation, updateUnitValidation } = require('../validations/orgUnitValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/unit-types', authorizePermission('org_structure.view'), orgUnitController.listTypes);
router.post('/unit-types', authorizePermission('org_structure.manage'), validate(createTypeValidation), orgUnitController.createType);
router.put('/unit-types/:typeId', authorizePermission('org_structure.manage'), validate([...typeIdParamValidation, ...updateTypeValidation]), orgUnitController.updateType);
router.get('/units', authorizePermission('org_structure.view'), orgUnitController.listUnits);
router.post('/units', authorizePermission('org_structure.manage'), validate(createUnitValidation), orgUnitController.createUnit);
router.put('/units/:unitId', authorizePermission('org_structure.manage'), validate([...unitIdParamValidation, ...updateUnitValidation]), orgUnitController.updateUnit);
router.patch('/units/:unitId/deactivate', authorizePermission('org_structure.manage'), validate(unitIdParamValidation), orgUnitController.deactivateUnit);

module.exports = router;
