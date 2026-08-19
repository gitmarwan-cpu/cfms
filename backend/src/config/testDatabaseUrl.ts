const TEST_DATABASE_ENV = 'CFMS_TEST_DATABASE_URL';
const TEST_DATABASE_NAME_PATTERN = /^cfms_test(?:_[a-z0-9][a-z0-9_-]*)?$/i;

const invalidTestDatabaseUrl = (): never => {
  throw new Error(`${TEST_DATABASE_ENV} must be a PostgreSQL URL for a database named cfms_test or cfms_test_*`);
};

export const parseTestDatabaseUrl = (value = process.env[TEST_DATABASE_ENV]): { url: string; databaseName: string } => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${TEST_DATABASE_ENV} is required when NODE_ENV=test`);
  }

  const url = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return invalidTestDatabaseUrl();
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    return invalidTestDatabaseUrl();
  }

  const encodedDatabaseName = parsed.pathname.replace(/^\/+/, '');
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(encodedDatabaseName);
  } catch {
    return invalidTestDatabaseUrl();
  }

  if (!databaseName || databaseName.includes('/') || !TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    return invalidTestDatabaseUrl();
  }

  return { url, databaseName };
};

export const getRequiredTestDatabaseUrl = (): string => parseTestDatabaseUrl().url;

export { TEST_DATABASE_ENV };
module.exports = { TEST_DATABASE_ENV, parseTestDatabaseUrl, getRequiredTestDatabaseUrl };
