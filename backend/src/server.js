'use strict';

const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 4000;

const start = async () => {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('✓ تم الاتصال بقاعدة البيانات بنجاح');

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`✓ خادم CFMS يعمل على المنفذ ${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('✗ فشل الاتصال بقاعدة البيانات:', err.message);
    process.exit(1);
  }
};

start();
