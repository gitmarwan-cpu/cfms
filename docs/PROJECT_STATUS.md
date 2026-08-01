# Project Status Snapshot

> لقطة حالة فعلية، وليست خطة. آخر تحديث عند commit `66deec9`. حدِّث هذا الملف
> مع أي تغيير معماري (راجع `AGENTS.md`).

## الوحدات (Routes) الموجودة فعلياً

| Route | الغرض | حالة المصادقة |
|---|---|---|
| `/api/auth` | تسجيل دخول، إنشاء مستخدمين (staff) | مختلط |
| `/api/public/:orgSlug/...` | بوابة عامة: هوية بصرية، بيانات مرجعية، تقديم/متابعة شكوى | بلا مصادقة |
| `/api/complaints` | إدارة الشكاوى (قائمة، تفاصيل، تحديث حالة، تسجيل يدوي) | مصادَق + Tenant |
| `/api/organization` | إعدادات المؤسسة الخاصة بالمستخدم | مصادَق + Tenant |
| `/api/org-structure` | الهيكل التنظيمي (أنواع الوحدات + الوحدات) | مصادَق + Tenant |
| `/api/reference-data` | إدارة القوائم المرجعية | مصادَق + Tenant |
| `/api/roles` | إدارة الأدوار والصلاحيات | مصادَق + Tenant |
| `/api/groups` | إدارة المجموعات | مصادَق + Tenant |
| `/api/users` | إسناد أدوار/مجموعات لمستخدم | مصادَق + Tenant |
| `/api/locations` | محافظات/مديريات (بيانات جغرافية عامة، غير مملوكة لمؤسسة) | بلا مصادقة |

## الجداول (Models) الموجودة فعلياً — 21 نموذج

**تعدد المؤسسات**: `Organization`, `OrgUnit`, `OrgUnitType`, `UserOrganization`.
**RBAC**: `Role`, `Permission`, `RolePermission`, `UserRole`, `Group`,
`GroupRole`, `UserGroup`.
**المستخدمون**: `User` (نظام)، `Complainant` (عام، منفصل تماماً).
**الشكاوى**: `Complaint`, `ComplaintAttachment`, `ComplaintStatusHistory`.
**البيانات المرجعية**: `ReferenceList`, `ReferenceListItem`.
**الجغرافيا**: `Country`, `Governorate`, `District`.

## الاختبارات

33 migration، 9 ملفات اختبار (`auth`, `complaints`, `groups`, `locations`,
`organization`, `referenceData`, `security`, `tenantIsolation` + `setup`).
كل الاختبارات على SQLite في الذاكرة — راجع تحذير `docs/DATABASE_CONVENTIONS.md`
بخصوص عدم كفاية هذا وحده للتحقق من الـ migrations الحقيقية.

## المراجعات المكتملة

- ✅ مراجعة أمنية منهجية شاملة (tenant isolation, RBAC, rate limiting, رفع
  ملفات) — ثغرتان حقيقيتان مُصلحتان + 4 إصلاحات إضافية (Rate Limiting، امتداد
  الملفات، توحيد 404/403، تحقق ملكية `managerUserId`/`allowedParentTypeId`).
- ✅ تحقق حي متكرر على Postgres حقيقي (وليس فقط sqlite) لكل تغيير مخطط منذ
  اكتشاف تناقض نموذج/migration حقيقي بهذه الطريقة تحديداً.

## الفجوات المعروفة (ليست أخطاء، نطاق لم يُبنَ بعد)

راجع قسم "القيود المعروفة الحالية" في [`ARCHITECTURE.md`](./ARCHITECTURE.md)
وحالة كل بند في [`ROADMAP.md`](./ROADMAP.md).

## أولويات موصى بها للعمل القادم

1. Workflow Engine (يفتح الباب لـ Assignment/Escalation الحقيقيين).
2. Notification Engine (الحد الأدنى: تأكيد تقديم الشكوى - مذكور في
   `modules/complaints/README.md` كوظيفة غير مبنية بعد رغم أنها في المخطط
   الأصلي لتدفق الوحدة).
3. Audit Trail عام (يفتح الباب لمتطلبات الامتثال في `Roadmap.md` 1.8).
4. Dashboard/Reporting الأساسي لوحدة الشكاوى.
