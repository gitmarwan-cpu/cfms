'use strict';

require('dotenv').config();

const { getRequiredTestDatabaseUrl } = require('../src/config/testDatabaseUrl');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const prisma = require('../src/prisma/client');

getRequiredTestDatabaseUrl();

describe('Prisma PostgreSQL client', () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('connects to the current PostgreSQL schema and reads application tables', async () => {
    const [databaseRow] = await prisma.$queryRaw`SELECT current_database() AS database_name`;
    const [complaintsTableRow] = await prisma.$queryRaw`SELECT to_regclass('public.complaints')::text AS table_name`;
    const [usersTableRow] = await prisma.$queryRaw`SELECT to_regclass('public.users')::text AS table_name`;

    await expect(prisma.complaints.count()).resolves.toEqual(expect.any(Number));
    await expect(prisma.users.count()).resolves.toEqual(expect.any(Number));

    expect(databaseRow.database_name).toBeTruthy();
    expect(complaintsTableRow.table_name).toBe('complaints');
    expect(usersTableRow.table_name).toBe('users');
  });
});
