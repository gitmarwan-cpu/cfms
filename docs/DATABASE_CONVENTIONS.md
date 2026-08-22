# Database Conventions

## Current test-database rule

The application and Jest tests use PostgreSQL. Jest must receive `CFMS_TEST_DATABASE_URL`; the test guard rejects missing or non-PostgreSQL URLs and verifies `current_database() = 'cfms_test'` before the allowlisted test reset. Tests must never derive their URL from the development `DATABASE_URL` or `DB_NAME=cfms_db` values. The SQLite/`sequelize.sync()` guidance below is historical and does not describe the current test harness.

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

الاختبارات الحالية تستخدم PostgreSQL المعزول `cfms_test` عبر Prisma، مع تحقق
صريح من هوية قاعدة البيانات قبل إعادة ضبط جداول الاختبار. أما اختبارات
المخطط وسلسلة Prisma فتستخدم `cfms_seed_validation` disposable فقط؛ ولا يجوز
استخدام `cfms_db` لهذه العمليات.

## Tenant Ownership

أي جدول "مملوك" لمؤسسة يجب أن يحمل `organization_id` (إلزامياً أو
Template+Override nullable). راجع [`TENANT_ISOLATION.md`](./TENANT_ISOLATION.md).
