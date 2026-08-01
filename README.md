# CFMS Platform

منصة مؤسسية متعددة القطاعات (Multi-Tenant Enterprise Platform)، مبنية على أساس
قابل لإعادة الاستخدام لأي عدد من الوحدات (Modules). **CFMS (نظام إدارة الشكاوى
والمقترحات)** هو **الوحدة الأولى والأكثر نضجاً** المبنية فوق هذا الأساس — وليس
المنصة نفسها.

المنصة مصمَّمة لخدمة أي مؤسسة تحتاج قناة تواصل/شكاوى منظَّمة: منظمات إنسانية،
منظمات غير ربحية، وكالات أممية، جهات حكومية، مؤسسات تعليمية وصحية، وشركات
قطاع خاص — عبر نفس البنية، دون أي افتراض حصري لقطاع واحد.

## أين تبدأ

| تريد | اذهب إلى |
|---|---|
| فهم المعمارية العامة (Multi-Tenant، عزل المؤسسات، RBAC) | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| خارطة الطريق والوحدات المستقبلية | [`docs/ROADMAP.md`](./docs/ROADMAP.md) |
| الحالة الفعلية الحالية لكل شيء (منجز/قيد التنفيذ) | [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) |
| مواصفة وحدة معينة (مثال: الشكاوى) | [`modules/`](./modules/) |
| اتجاه تصميم الواجهة الأمامية (مستهدف، وليس الحالة الحالية بالكامل) | [`frontend/docs/FRONTEND_DESIGN_SPEC.md`](./frontend/docs/FRONTEND_DESIGN_SPEC.md) |
| قواعد قاعدة البيانات، الـ RBAC، البيانات المرجعية، الـ API | [`docs/`](./docs/) |
| قواعد العمل قبل أي تعديل | [`AGENTS.md`](./AGENTS.md) |

## التشغيل السريع

### Backend

```bash
cd backend
cp .env.example .env      # عدّل بيانات الاتصال بقاعدة البيانات و JWT_SECRET
npm install
npm run migrate            # تنفيذ كل الـ migrations
npm run seed                # بيانات أولية: دول، محافظات/مديريات يمنية، قوائم مرجعية،
                             # مؤسسة افتراضية + أول Super Admin (Bootstrap - راجع
                             # BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD في .env)
npm run dev                  # يعمل على المنفذ 4000
```

> ⚠️ لا يوجد مستخدم افتراضي ثابت في الكود — أول Super Admin يُنشَأ مرة واحدة فقط
> عبر seeder التنصيب (`seed-bootstrap-default-organization`)، بالبريد/كلمة المرور
> المحدَّدين في متغيرات البيئة (أو قيم افتراضية للتطوير المحلي فقط، **يجب تغييرها
> فوراً في أي بيئة حقيقية**).

### تشغيل الاختبارات

```bash
cd backend && npm test
```

تستخدم الاختبارات SQLite في الذاكرة (`sequelize.sync()`) لتبقى سريعة ومعزولة.
**ملاحظة مهمة**: هذا لا يُغني عن التحقق من الـ migrations الفعلية على Postgres
حقيقي قبل أي دمج يمس المخطط (راجع [`docs/DATABASE_CONVENTIONS.md`](./docs/DATABASE_CONVENTIONS.md)) —
اكتُشف سابقاً تناقض حقيقي بين نموذج وmigration لم تكشفه الاختبارات لهذا السبب بالضبط.

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

بوابة الشكاوى العامة تُستهلك عبر رابط خاص بكل مؤسسة: `/{orgSlug}` (مثال:
`/save-the-children-ye`)، ومتابعة الشكوى عبر `/{orgSlug}/track`.

## البنية

```
cfms/
  backend/     Express API + Sequelize (PostgreSQL) + JWT Auth + RBAC
  frontend/    React (Vite) - بوابة عامة متعددة المؤسسات + نموذج تقديم شكوى/مقترح
  docs/        توثيق معماري على مستوى المنصة (اقرأه قبل أي تعديل معماري)
  modules/     مواصفات كل وحدة عمل على حدة (الشكاوى، المؤسسات، المستخدمين...)
```
