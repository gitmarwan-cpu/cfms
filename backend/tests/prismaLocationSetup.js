'use strict';

const prisma = require('../src/prisma/client');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');

let seedCountry;
let seedGovernorates;

beforeAll(async () => {
  await prepareTestDatabase();

  const now = new Date();
  seedCountry = await prisma.countries.create({
    data: {
      iso2: 'YE',
      iso3: 'YEM',
      name_ar: 'اليمن',
      name_en: 'Yemen',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  });

  const ibb = await prisma.governorates.create({
    data: {
      name_en: 'Ibb',
      name_ar: 'إب',
      is_active: true,
      country_id: seedCountry.id,
      created_at: now,
      updated_at: now,
    },
  });
  const abyan = await prisma.governorates.create({
    data: {
      name_en: 'Abyan',
      name_ar: 'أبين',
      is_active: true,
      country_id: seedCountry.id,
      created_at: now,
      updated_at: now,
    },
  });

  await prisma.districts.createMany({
    data: [
      {
        name_en: 'Al Qafr',
        name_ar: 'القفر',
        governorate_id: ibb.id,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name_en: 'Yarim',
        name_ar: 'يريم',
        governorate_id: ibb.id,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name_en: 'Ahwar',
        name_ar: 'أحور',
        governorate_id: abyan.id,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
  });

  seedGovernorates = { ibb, abyan };
});

afterAll(async () => {
  await closeTestDatabase();
});

module.exports = {
  getSeedCountry: () => seedCountry,
  getSeedGovernorates: () => seedGovernorates,
};
