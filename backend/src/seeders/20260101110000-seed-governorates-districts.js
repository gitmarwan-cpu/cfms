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
    // حارس idempotency: sequelize-cli لا يتتبّع الـ seeders المُنفَّذة
    // افتراضياً (لا يوجد seederStorage مُفعَّل) - أي db:seed:all يُعيد
    // تشغيل كل الملفات في كل مرة. هذا هو السبب الجذري لخطأ تكرار المفتاح
    // (Ibb) الذي واجهناه سابقاً في هذا المشروع. الحل: تخطّي كامل الـ seeder
    // إن كانت البيانات موجودة بالفعل.
    const [[{ count }]] = await queryInterface.sequelize.query('SELECT COUNT(*)::int FROM governorates;');
    if (count > 0) {
      return;
    }

    const dataPath = path.join(__dirname, '..', '..', 'data', 'yemen_admin.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const { governorates, districts } = JSON.parse(raw);

    const now = new Date();

    // هذا الـ seeder لا يعتمد على ترتيب تشغيل seed-countries (قد يُشغَّل
    // قبله أبجدياً) - يضمن وجود اليمن بنفسه (idempotent) قبل إدراج أي
    // محافظة، بعد أن كشف اختبار تشغيل فعلي أن الاعتماد الضمني على ترتيب
    // الملفات كان يُسبب خطأ NOT NULL على country_id.
    await queryInterface.sequelize.query(
      `
      INSERT INTO countries (iso2, iso3, name_ar, name_en, is_active, created_at, updated_at)
      VALUES ('YE', 'YEM', 'اليمن', 'Yemen', true, :now, :now)
      ON CONFLICT (iso2) DO NOTHING;
      `,
      { replacements: { now } }
    );
    const [[yemen]] = await queryInterface.sequelize.query(`SELECT id FROM countries WHERE iso2 = 'YE';`);
    const countryId = yemen.id;

    const governorateRows = governorates.map((g) => ({
      name_en: g.name_en,
      name_ar: g.name_ar,
      country_id: countryId,
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
