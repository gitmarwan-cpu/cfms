# Database Conventions

## Current test-database rule

The application and Jest tests use PostgreSQL. Jest must receive `CFMS_TEST_DATABASE_URL`; the test guard rejects missing or non-PostgreSQL URLs and verifies `current_database() = 'cfms_test'` before the allowlisted test reset. Tests must never derive their URL from the development `DATABASE_URL` or `DB_NAME=cfms_db` values. The SQLite/`sequelize.sync()` guidance below is historical and does not describe the current test harness.

## Migrations

- الهجرات التشغيلية الحالية موجودة في `backend/prisma/migrations` وتُطبَّق
  عبر `prisma migrate deploy`.
- هجرات Prisma forward-only؛ لا يوجد أمر عام مكافئ لـ
  `sequelize-cli db:migrate:undo:all`. تُعالَج التصحيحات بهجرة Prisma جديدة
  ومراجَعة.
- قبل تطبيق الهجرات على قاعدة موجودة، تحقّق من حالة `_prisma_migrations`
  وخطة baseline المعتمدة.

## Prisma seed

يُشغَّل الـ seed الرسمي عبر `prisma db seed`، وهو الأمر المستخدم من
`npm run seed`. يفرض `backend/prisma/seed.ts` متطلبات قاعدة seed الآمنة ولا
يقبل `cfms_db`.

## Historical Sequelize migrations/seeders

الملفات تحت `backend/src/migrations` و`backend/src/seeders` محفوظة كسجل
تاريخي فقط في هذه المرحلة. لا تستخدمها لتشغيل الهجرات أو seed في التشغيل
الحالي. القاعدة التاريخية التالية تخص هذه الملفات فقط:

### Historical Sequelize migration rules

كانت الهجرات التاريخية تستخدم تسمية `YYYYMMDDHHmmss-verb-noun.js`، وكانت
الأعمدة تُدار بصيغة `snake_case` عبر إعداد `underscored: true`. عند إضافة عمود
إلزامي إلى جدول يحتوي بيانات، كان يُضاف nullable أولاً، ثم يُجرى backfill، ثم
يُحوَّل إلى `allowNull: false`. وكان backfill الذي يحتاج بيانات مرجعية ينشئها
داخل الهجرة نفسها وبشكل idempotent، بدلاً من الاعتماد على seeder منفصل.

**`sequelize-cli` لا يتتبّع الـ seeders المُنفَّذة افتراضياً.** `db:seed:all`
كان يعيد تشغيل كل ملف من الصفر في كل استدعاء. كل seeder تاريخي جديد كان
يتطلب حارس idempotency صريحاً:

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
