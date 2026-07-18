'use strict';

const path = require('path');
const fs = require('fs');

/**
 * يستورد هذا الـ seeder بيانات المحافظات والمديريات اليمنية
 * من الملف data/yemen_admin.json (المُستخرج والمُنظّف من ملف
 * "المحافظات اليمنية والمديريات.xlsx" - ورقة Admin، وهي أنظف
 * أوراق الملف الأصلي: 22 محافظة، 335 مديرية، بدون تكرار أو
 * مديريات يتيمة بدون محافظة أب).
 *
 * الأسماء العربية (name_ar) مأخوذة مباشرة من عمود label في
 * الملف الأصلي (لم تكن بحاجة لترجمة إضافية لأنها كانت موجودة
 * فعلاً في الملف المصدر).
 */
module.exports = {
  up: async (queryInterface) => {
    const dataPath = path.join(__dirname, '..', '..', 'data', 'yemen_admin.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const { governorates, districts } = JSON.parse(raw);

    const now = new Date();

    const governorateRows = governorates.map((g) => ({
      name_en: g.name_en,
      name_ar: g.name_ar,
      is_active: true,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('governorates', governorateRows, {});

    const insertedGovernorates = await queryInterface.sequelize.query(
      'SELECT id, name_en FROM governorates;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const govNameToId = insertedGovernorates.reduce((acc, row) => {
      acc[row.name_en] = row.id;
      return acc;
    }, {});

    const districtRows = districts
      .filter((d) => govNameToId[d.gov_en])
      .map((d) => ({
        name_en: d.name_en,
        name_ar: d.name_ar,
        governorate_id: govNameToId[d.gov_en],
        is_active: true,
        created_at: now,
        updated_at: now,
      }));

    await queryInterface.bulkInsert('districts', districtRows, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('districts', null, {});
    await queryInterface.bulkDelete('governorates', null, {});
  },
};
