'use strict';

const prisma = require('../src/prisma/client');
const { Prisma } = require('@prisma/client');
const { parseTestDatabaseUrl } = require('../src/config/testDatabaseUrl');

// Explicit allowlist from the reviewed PostgreSQL baseline. Prisma metadata is
// intentionally excluded and is never truncated by this utility.
const TEST_TABLES = [
  'audit_logs',
  'notifications',
  'countries',
  'governorates',
  'districts',
  'organizations',
  'complainants',
  'reference_lists',
  'reference_list_items',
  'org_unit_types',
  'org_units',
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'user_organizations',
  'groups',
  'group_roles',
  'user_groups',
  'workflow_definitions',
  'workflow_states',
  'workflow_transitions',
  'complaints',
  'complaint_attachments',
  'complaint_status_history',
  'sla_rules',
  'complaint_escalation_events',
];

const getTestDatabase = () => parseTestDatabaseUrl();

const assertTestMode = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test database operations require NODE_ENV=test');
  }
};

const verifyCurrentDatabase = async () => {
  assertTestMode();
  const { databaseName } = getTestDatabase();
  if (databaseName !== 'cfms_test') {
    throw new Error('Jest requires the dedicated PostgreSQL database cfms_test');
  }

  const [row] = await prisma.$queryRaw`SELECT current_database() AS database_name`;

  if (!row || row.database_name !== databaseName) {
    throw new Error('Connected PostgreSQL database does not match CFMS_TEST_DATABASE_URL');
  }

  return row.database_name;
};

const verifyTestSchema = async () => {
  await verifyCurrentDatabase();

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (${Prisma.join(TEST_TABLES)})
  `;
  const presentTables = new Set(tables.map((table) => table.table_name));
  const missingTables = TEST_TABLES.filter((table) => !presentTables.has(table));

  const columns = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complainants'
      AND column_name = 'relationship_item_id'
  `;

  if (missingTables.length || columns.length !== 1) {
    const missing = [...missingTables];
    if (columns.length !== 1) missing.push('complainants.relationship_item_id');
    throw new Error(
      `Test database schema is not prepared. Missing: ${missing.join(', ')}. `
      + 'Prepare cfms_test separately; Jest will not run Prisma migrations automatically.'
    );
  }

  return { databaseName: 'cfms_test', tables: TEST_TABLES };
};

const resetTestDatabase = async () => {
  await verifyCurrentDatabase();

  const tableList = TEST_TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

const prepareTestDatabase = async () => {
  await verifyTestSchema();
  await resetTestDatabase();
};

const closeTestDatabase = async () => {
  await prisma.$disconnect();
};

module.exports = {
  getTestDatabase,
  verifyCurrentDatabase,
  verifyTestSchema,
  resetTestDatabase,
  prepareTestDatabase,
  closeTestDatabase,
};
