# Modules

هذا المجلد يحتوي مواصفة كل وحدة أعمال (Business Module) على حدة، منفصلة عن
توثيق المنصة العام في [`../docs/`](../docs/) (الذي يغطي الأساس المشترك:
Multi-Tenant, RBAC, Reference Data).

| الوحدة | الحالة | الوصف |
|---|---|---|
| [`complaints/`](./complaints/README.md) | 🔶 قيد التطوير (الأكثر نضجاً) | الوحدة الأولى للمنصة — إدارة الشكاوى والملاحظات |
| [`organizations/`](./organizations/README.md) | ✅ منجز جزئياً | المؤسسات والهيكل التنظيمي المرن |
| [`users-permissions/`](./users-permissions/README.md) | ✅ منجز | المستخدمون، الأدوار، الصلاحيات، عضوية المؤسسات |
| [`reference-data/`](./reference-data/README.md) | ✅ منجز | البيانات المرجعية القابلة للتخصيص |

وحدات مستقبلية (HR، إدارة المشاريع، المنح...) — راجع
[`../docs/ROADMAP.md`](../docs/ROADMAP.md) قسم Phase 4. لا توجد مواصفة لها بعد
لأنها لم تبدأ.

## عند إضافة وحدة جديدة

أنشئ `modules/<اسم-الوحدة>/README.md` يغطي: الكيانات (Models)، نقاط الـ API،
حالة كل بند وظيفي مقابل الخطة، والاعتماد على الأساس المشترك (Tenant Isolation،
RBAC، Reference Data) دون إعادة بنائه.
