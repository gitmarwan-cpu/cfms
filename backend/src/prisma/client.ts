import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ensurePrismaDatabaseUrl } from './databaseUrl';

ensurePrismaDatabaseUrl();

const prisma = new PrismaClient({
  log: process.env.PRISMA_QUERY_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export default prisma;
module.exports = prisma;
