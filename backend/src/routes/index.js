'use strict';

const express = require('express');
const authRoutes = require('./authRoutes');
const locationRoutes = require('./locationRoutes');
const complaintRoutes = require('./complaintRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.status(200).json({ success: true, message: 'CFMS API is running' }));

router.use('/auth', authRoutes);
router.use('/locations', locationRoutes);
router.use('/complaints', complaintRoutes);

module.exports = router;
