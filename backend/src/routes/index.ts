import express from 'express';
import authRoutes from './authRoutes';
import locationRoutes from './locationRoutes';
import complaintRoutes from './complaintRoutes';
import referenceDataRoutes from './referenceDataRoutes';
import organizationRoutes from './organizationRoutes';
import orgUnitRoutes from './orgUnitRoutes';
import roleRoutes from './roleRoutes';
import userRoutes from './userRoutes';
import publicRoutes from './publicRoutes';
import auditRoutes from './auditRoutes';
import notificationRoutes from './notificationRoutes';
import reportRoutes from './reportRoutes';
import slaRoutes from './slaRoutes';
import platformTenantRoutes from './platformTenantRoutes';
import platformUserRoutes from './platformUserRoutes';
import prisma from '../prisma/client';
import type { AppRequest, AppResponse } from '../types/http';

const router = express.Router();
router.get('/health', (_req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'CFMS API is running' }));
router.get('/health/ready', async (_req: AppRequest, res: AppResponse) => {
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
router.use('/users', userRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/sla-rules', slaRoutes);
router.use('/platform', platformTenantRoutes);
router.use('/platform', platformUserRoutes);

export default router;
