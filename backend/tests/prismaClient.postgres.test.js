'use strict';

require('dotenv').config();

const prisma = require('../src/prisma/client');

const hasPostgresConfig =
  !!process.env.DATABASE_URL || (!!process.env.DB_USER && process.env.DB_PASSWORD !== undefined && !!process.env.DB_NAME);

(hasPostgresConfig ? describe : describe.skip)('Prisma PostgreSQL client', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('connects to the current PostgreSQL schema and reads Sequelize-managed tables', async () => {
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
