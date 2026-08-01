# Database Conventions

## Migrations

- تسمية: `YYYYMMDDHHmmss-verb-noun.js`.
- `underscored: true` في كل النماذج — أعمدة DB بصيغة `snake_case`، حقول
  Sequelize بصيغة `camelCase`.
- أي عمود جديد إلزامي على جدول قد يحتوي بيانات فعلياً: `allowNull: true`
  أولاً، Backfill، ثم `changeColumn` إلى `allowNull: false`.
- الـ Backfill الذي يحتاج بيانات مرجعية (مثال: دور معيّن) يجب أن **يُنشئها
  بنفسه داخل نفس الـ migration** (idempotent عبر `ON CONFLICT DO NOTHING`)،
  وليس الاعتماد على أن seeder آخر سيُشغَّل قبله.

## Seeders — القاعدة الأهم في هذا المشروع

**`sequelize-cli` لا يتتبّع الـ seeders المُنفَّذة افتراضياً.** `db:seed:all`
يُعيد تشغيل كل ملف من الصفر في كل استدعاء. **كل seeder جديد بلا استثناء يجب
أن يبدأ بحارس idempotency صريح**:

```js
const [[{ count }]] = await queryInterface.sequelize.query(
  `SELECT COUNT(*)::int FROM <table> WHERE <شرط دقيق يخص هذا الـ seeder تحديداً>;`
);
if (count > 0) return;
```

## قبل اعتماد أي migration/seeder: تحقّق حقيقي، لا افتراض

الاختبارات تستخدم **sqlite في الذاكرة عبر `sequelize.sync()`**، وليس الـ
migrations الحقيقية — نجاح الاختبارات **لا يثبت** أن الـ migration ستعمل على
Postgres حقيقي (اكتُشف تناقض حقيقي بين نموذج `Complaint` وmigration فعلية
بهذه الطريقة تحديداً). **قبل اعتماد أي تغيير مخطط**: شغّل `db:migrate` و
`db:seed:all` (مرتين متتاليتين للتأكد من idempotency) على Postgres فعلي محلي.

## Tenant Ownership

أي جدول "مملوك" لمؤسسة يجب أن يحمل `organization_id` (إلزامياً أو
Template+Override nullable). راجع [`TENANT_ISOLATION.md`](./TENANT_ISOLATION.md).
