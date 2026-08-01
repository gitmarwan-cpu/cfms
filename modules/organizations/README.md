# Module: Organizations & Structure

جزء من **Core Platform** — الأساس الذي تُبنى عليه كل وحدة أعمال.

## الكيانات

| الكيان | الغرض |
|---|---|
| `Organization` | المؤسسة (المستأجر/Tenant). تحمل `slug` فريد للبوابة العامة، الهوية البصرية، الإعدادات. |
| `OrgUnit` | وحدة تنظيمية (فرع/قسم/قطاع...) — هرمية عبر `parent_id`، بلا حد لعدد المستويات. |
| `OrgUnitType` | نوع الوحدة (قابل للتخصيص لكل مؤسسة)، مع `hierarchy_level` و`allowed_parent_type_id` لفرض تسلسل منطقي. |
| `UserOrganization` | عضوية مستخدم في مؤسسة (M:N حقيقي) — مستقل عن الصلاحية (قد ينضم بلا أي دور). |

## الهيكل التنظيمي مرن، وليس ثابتاً

**لا** جداول منفصلة ثابتة لـ "فرع"/"قسم"/"فريق" — `OrgUnitType` نفسه بيانات
تُدار من لوحة الإدارة لكل مؤسسة، تسمح بأي تسلسل هرمي مخصَّص (مثال: قطاع ←
فرع ← قسم ← فريق، أو أي تركيب آخر تحدده المؤسسة).

## تعدد الانتماء (Multi-Organization Membership)

مستخدم واحد قد ينتمي لعدة مؤسسات (`UserOrganization`)، بدور/مجموعة مختلفة في
كل منها (`UserRole`/`UserGroup` يحملان `organization_id` منفصلاً لكل تعيين).
`users.default_organization_id` مجرد إشارة سريعة (denormalized) للمؤسسة
الافتراضية عند الدخول — **ليست** مصدر الحقيقة (المصدر الحقيقي `UserOrganization`).

## البوابة العامة لكل مؤسسة

`organizations.slug` هو المعرِّف العلني المستخدم في رابط البوابة العامة
(`/api/public/:orgSlug/...`) لتحديد المؤسسة لمستفيد غير مسجَّل دخوله إطلاقاً.

## Bootstrap (التنصيب الأول)

مؤسسة افتراضية + أول Super Admin تُنشآن **مرة واحدة فقط** عند أول تشغيل
(`seed-bootstrap-default-organization`، حارس صريح يتحقق أولاً أن لا مؤسسة
موجودة إطلاقاً). **لا** يُنشأ مؤسسة جديدة تلقائياً لكل مستخدم جديد — إنشاء
مؤسسات إضافية يتم يدوياً عبر Super Admin حالياً (SaaS Onboarding التلقائي
مؤجَّل، البنية جاهزة له لاحقاً دون تعديل النموذج الأساسي).

## الحالة مقابل `Roadmap.md` 1.2

| البند | الحالة |
|---|---|
| Organization, Branches/Departments/Teams (عبر OrgUnit مرن) | ✅ منجز |
| Organization Settings, Branding | ✅ منجز |
| Default Country | ✅ منجز |
| Contact Information موسَّعة | ⏳ الأساسي فقط (phone/email/website) |
