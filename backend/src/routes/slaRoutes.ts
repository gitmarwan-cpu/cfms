const express = require('express');
const slaController = require('../controllers/slaController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { createSlaRuleValidation, updateSlaRuleValidation } = require('../validations/slaValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/', authorizePermission('organization.view'), slaController.listSlaRules);
router.post('/', authorizePermission('organization.manage'), validate(createSlaRuleValidation), slaController.createSlaRule);
router.post('/evaluate', authorizePermission('complaints.view_all'), slaController.evaluateSla);
router.patch('/:id', authorizePermission('organization.manage'), validate(updateSlaRuleValidation), slaController.updateSlaRule);

module.exports = router;
