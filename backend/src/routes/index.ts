const express = require('express');
const authRoutes = require('./authRoutes');
const locationRoutes = require('./locationRoutes');
const complaintRoutes = require('./complaintRoutes');
const referenceDataRoutes = require('./referenceDataRoutes');
const organizationRoutes = require('./organizationRoutes');
const orgUnitRoutes = require('./orgUnitRoutes');
const roleRoutes = require('./roleRoutes');
const groupRoutes = require('./groupRoutes');
const userRoutes = require('./userRoutes');
const publicRoutes = require('./publicRoutes');
const auditRoutes = require('./auditRoutes');
const notificationRoutes = require('./notificationRoutes');
const reportRoutes = require('./reportRoutes');
const slaRoutes = require('./slaRoutes');
const prisma = require('../prisma/client');
export {};

const router = express.Router();
router.get('/health', (req: any, res: any) => res.status(200).json({ success: true, message: 'CFMS API is running' }));
router.get('/health/ready', async (req: any, res: any) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ success: true, status: 'ready' });
  } catch {
    res.status(503).json({ success: false, status: 'not_ready' });
  }
});
router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/locations', locationRoutes);
router.use('/complaints', complaintRoutes);
router.use('/reference-data', referenceDataRoutes);
router.use('/organization', organizationRoutes);
router.use('/org-structure', orgUnitRoutes);
router.use('/roles', roleRoutes);
router.use('/groups', groupRoutes);
router.use('/users', userRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/sla-rules', slaRoutes);

module.exports = router;
