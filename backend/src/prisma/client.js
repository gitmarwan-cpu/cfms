'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { ensurePrismaDatabaseUrl } = require('./databaseUrl');

ensurePrismaDatabaseUrl();

const prisma = new PrismaClient({
  log: process.env.PRISMA_QUERY_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

module.exports = prisma;
