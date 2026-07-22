'use strict';

const express = require('express');
const authRoutes = require('./authRoutes');
const locationRoutes = require('./locationRoutes');
const complaintRoutes = require('./complaintRoutes');
const referenceDataRoutes = require('./referenceDataRoutes');
const organizationRoutes = require('./organizationRoutes');
const orgUnitRoutes = require('./orgUnitRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.status(200).json({ success: true, message: 'CFMS API is running' }));

router.use('/auth', authRoutes);
router.use('/locations', locationRoutes);
router.use('/complaints', complaintRoutes);
router.use('/reference-data', referenceDataRoutes);
router.use('/organization', organizationRoutes);
// هيكل الوحدات التنظيمية متداخل تحت المؤسسة: /api/org-structure/:organizationId/...
router.use('/org-structure', orgUnitRoutes);

module.exports = router;
