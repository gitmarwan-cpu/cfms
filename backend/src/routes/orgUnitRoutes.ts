const express = require('express');
const orgUnitController = require('../controllers/orgUnitController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { typeIdParamValidation, createTypeValidation, updateTypeValidation } = require('../validations/orgUnitValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/unit-types', authorizePermission('org_structure.view'), orgUnitController.listTypes);
router.post('/unit-types', authorizePermission('org_structure.manage'), validate(createTypeValidation), orgUnitController.createType);
router.put('/unit-types/:typeId', authorizePermission('org_structure.manage'), validate([...typeIdParamValidation, ...updateTypeValidation]), orgUnitController.updateType);

module.exports = router;
