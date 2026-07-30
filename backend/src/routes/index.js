'use strict';

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

const router = express.Router();

router.get('/health', (req, res) => res.status(200).json({ success: true, message: 'CFMS API is running' }));

// البوابة العامة (بلا مصادقة، لكل مؤسسة عبر slug): /api/public/:orgSlug/...
router.use('/public', publicRoutes);

router.use('/auth', authRoutes);
router.use('/locations', locationRoutes);
router.use('/complaints', complaintRoutes);
router.use('/reference-data', referenceDataRoutes);
router.use('/organization', organizationRoutes);
// هيكل الوحدات التنظيمية: يُحدَّد ضمن مؤسسة المستخدم المصادَق عليه (resolveAuthenticatedTenant)
router.use('/org-structure', orgUnitRoutes);
// إدارة الأدوار والصلاحيات (RBAC)
router.use('/roles', roleRoutes);
// إدارة المجموعات (Groups) - طبقة توزيع أدوار إضافية فوق user_roles المباشر
router.use('/groups', groupRoutes);
// إسناد/إلغاء الأدوار والمجموعات لمستخدم معيّن: /api/users/:userId/roles و /groups
router.use('/users', userRoutes);

module.exports = router;
