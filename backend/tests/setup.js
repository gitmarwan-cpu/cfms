'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_jest_only';
process.env.JWT_EXPIRES_IN = '1h';

const { sequelize, Governorate, District, ReferenceList, ReferenceListItem } = require('../src/models');

const REFERENCE_SEED = [
  {
    key: 'gender',
    nameAr: 'الجنس',
    items: [
      { code: 'male', labelAr: 'ذكر' },
      { code: 'female', labelAr: 'أنثى' },
    ],
  },
  {
    key: 'age_group',
    nameAr: 'الفئة العمرية',
    items: [
      { code: 'under_18', labelAr: 'أقل من 18' },
      { code: '18_30', labelAr: '18 - 30' },
      { code: '31_45', labelAr: '31 - 45' },
      { code: '46_60', labelAr: '46 - 60' },
      { code: 'above_60', labelAr: 'أكثر من 60' },
    ],
  },
  {
    key: 'complaint_category',
    nameAr: 'تصنيف الشكوى',
    items: [
      { code: 'service_quality', labelAr: 'جودة الخدمة' },
      { code: 'staff_behavior', labelAr: 'سلوك موظف' },
      { code: 'corruption_fraud', labelAr: 'فساد / احتيال' },
      { code: 'distribution_issue', labelAr: 'مشكلة في التوزيع' },
      { code: 'protection_gbv', labelAr: 'حماية / عنف قائم على النوع الاجتماعي' },
      { code: 'suggestion', labelAr: 'مقترح تحسين' },
      { code: 'other', labelAr: 'أخرى' },
    ],
  },
  {
    key: 'channel',
    nameAr: 'قناة الاستلام',
    items: [
      { code: 'website', labelAr: 'الموقع الإلكتروني', isDefault: true },
      { code: 'in_person', labelAr: 'حضوري' },
      { code: 'hotline', labelAr: 'الخط الساخن' },
      { code: 'suggestion_box', labelAr: 'صندوق الاقتراحات' },
      { code: 'email', labelAr: 'البريد الإلكتروني' },
      { code: 'field_visit', labelAr: 'زيارة ميدانية' },
    ],
  },
];

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

  // زرع البيانات المرجعية (بديل الثوابت السابقة) حتى يعمل التحقق الديناميكي في الاختبارات
  for (const list of REFERENCE_SEED) {
    const createdList = await ReferenceList.create({ key: list.key, nameAr: list.nameAr, isSystem: false });
    await ReferenceListItem.bulkCreate(
      list.items.map((item, index) => ({
        referenceListId: createdList.id,
        code: item.code,
        labelAr: item.labelAr,
        sortOrder: index + 1,
        isActive: true,
        isDefault: !!item.isDefault,
      }))
    );
  }
});

afterAll(async () => {
  await sequelize.close();
});

module.exports = { sequelize };
