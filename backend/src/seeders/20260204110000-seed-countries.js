'use strict';

/**
 * قائمة دول أولية (وليست شاملة) — قابلة للتوسع من لوحة الإدارة لاحقاً.
 * يُبقي التركيز على المنطقة الأكثر صلة بسياق المنظمات الإنسانية المستهدفة
 * حالياً، مع ترك الباب مفتوحاً لإضافة أي دولة عبر reference API مستقبلاً.
 * idempotent عمداً (ON CONFLICT) بعد الدرس المستفاد سابقاً من seed المحافظات.
 */
const COUNTRIES = [
  { iso2: 'YE', iso3: 'YEM', name_ar: 'اليمن', name_en: 'Yemen' },
  { iso2: 'SA', iso3: 'SAU', name_ar: 'السعودية', name_en: 'Saudi Arabia' },
  { iso2: 'JO', iso3: 'JOR', name_ar: 'الأردن', name_en: 'Jordan' },
  { iso2: 'EG', iso3: 'EGY', name_ar: 'مصر', name_en: 'Egypt' },
  { iso2: 'SY', iso3: 'SYR', name_ar: 'سوريا', name_en: 'Syria' },
  { iso2: 'IQ', iso3: 'IRQ', name_ar: 'العراق', name_en: 'Iraq' },
  { iso2: 'LB', iso3: 'LBN', name_ar: 'لبنان', name_en: 'Lebanon' },
  { iso2: 'SO', iso3: 'SOM', name_ar: 'الصومال', name_en: 'Somalia' },
  { iso2: 'SD', iso3: 'SDN', name_ar: 'السودان', name_en: 'Sudan' },
  { iso2: 'AE', iso3: 'ARE', name_ar: 'الإمارات', name_en: 'United Arab Emirates' },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const values = COUNTRIES.map(
      (c) => `('${c.iso2}', '${c.iso3}', '${c.name_ar}', '${c.name_en.replace(/'/g, "''")}', true, :now, :now)`
    ).join(',\n');

    await queryInterface.sequelize.query(
      `
      INSERT INTO countries (iso2, iso3, name_ar, name_en, is_active, created_at, updated_at)
      VALUES ${values}
      ON CONFLICT (iso2) DO NOTHING;
      `,
      { replacements: { now } }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`DELETE FROM countries WHERE iso2 != 'YE';`);
  },
};
