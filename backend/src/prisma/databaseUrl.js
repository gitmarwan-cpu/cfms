'use strict';

const buildPrismaDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME;

  if (!user || password === undefined || !database) {
    return null;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
};

const ensurePrismaDatabaseUrl = () => {
  const databaseUrl = buildPrismaDatabaseUrl();
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }
  return databaseUrl;
};

module.exports = {
  buildPrismaDatabaseUrl,
  ensurePrismaDatabaseUrl,
};
