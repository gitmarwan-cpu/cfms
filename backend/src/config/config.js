require('dotenv').config();

const TEST_DATABASE_NAME_PATTERN = /^cfms_test(?:_[a-z0-9][a-z0-9_-]*)?$/i;

const validateTestDatabaseUrl = () => {
  const value = process.env.CFMS_TEST_DATABASE_URL;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('CFMS_TEST_DATABASE_URL is required when NODE_ENV=test');
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('CFMS_TEST_DATABASE_URL must be a PostgreSQL URL for a database named cfms_test or cfms_test_*');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error('CFMS_TEST_DATABASE_URL must be a PostgreSQL URL for a database named cfms_test or cfms_test_*');
  }
};

if (process.env.NODE_ENV === 'test') {
  validateTestDatabaseUrl();
}

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    use_env_variable: 'CFMS_TEST_DATABASE_URL',
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
