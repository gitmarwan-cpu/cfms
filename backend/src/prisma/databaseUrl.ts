import { getRequiredTestDatabaseUrl } from '../config/testDatabaseUrl';

const TEST_DATABASE_NAME_PATTERN = /^cfms_test(?:_[a-z0-9][a-z0-9_-]*)?$/i;

const getDatabaseNameFromUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
};

const assertNonTestDatabase = (databaseName: string | null | undefined): void => {
  if (databaseName && TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error('Non-test Prisma runtime cannot use a cfms_test database');
  }
};

export const buildPrismaDatabaseUrl = (): string | null => {
  if (process.env.NODE_ENV === 'test') {
    return getRequiredTestDatabaseUrl();
  }

  if (process.env.DATABASE_URL) {
    assertNonTestDatabase(getDatabaseNameFromUrl(process.env.DATABASE_URL));
    return process.env.DATABASE_URL;
  }

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME;

  if (!user || password === undefined || !database) return null;

  assertNonTestDatabase(database);
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

export const ensurePrismaDatabaseUrl = (): string | null => {
  const databaseUrl = buildPrismaDatabaseUrl();
  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
};

module.exports = { buildPrismaDatabaseUrl, ensurePrismaDatabaseUrl };
