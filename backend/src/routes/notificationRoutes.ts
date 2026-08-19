const express = require('express');
const notificationController = require('../controllers/notificationController');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { notificationListValidation, notificationIdValidation } = require('../validations/notificationValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/', validate(notificationListValidation), notificationController.list);
router.patch('/:id/read', validate(notificationIdValidation), notificationController.markRead);

module.exports = router;
