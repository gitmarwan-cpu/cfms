'use strict';

require('dotenv').config({ path: '.env.test' });

if (process.env.NODE_ENV === 'test') {
  require('../src/config/testDatabaseUrl').getRequiredTestDatabaseUrl();
}
