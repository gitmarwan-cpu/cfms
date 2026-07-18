'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_jest_only';
process.env.JWT_EXPIRES_IN = '1h';

const { sequelize, Governorate, District } = require('../src/models');

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // بيانات أولية كافية للاختبارات: محافظتان ومديريات تابعة لهما
  const ibb = await Governorate.create({ nameEn: 'Ibb', nameAr: 'إب' });
  const abyan = await Governorate.create({ nameEn: 'Abyan', nameAr: 'أبين' });

  await District.bulkCreate([
    { nameEn: 'Al Qafr', nameAr: 'القفر', governorateId: ibb.id },
    { nameEn: 'Yarim', nameAr: 'يريم', governorateId: ibb.id },
    { nameEn: 'Ahwar', nameAr: 'أحور', governorateId: abyan.id },
  ]);
});

afterAll(async () => {
  await sequelize.close();
});

module.exports = { sequelize };
