# RBAC — Roles and Permissions

هذه الوحدة جزء من **Core Platform** (وليست خاصة بـ CFMS) — أي وحدة أعمال
مستقبلية تستخدم نفس النظام دون تعديل.

## الجداول

| جدول | الغرض |
|---|---|
| `permissions` | كتالوج نظامي بالكامل (مشترك بين كل المؤسسات دوماً). لا Template+Override هنا. |
| `roles` | Template+Override. `is_system=true` (admin/staff) لا يمكن حذفه/تعديله. |
| `role_permissions` | جسر m:n بين دور وصلاحياته. |
| `user_roles` | إسناد مباشر: مستخدم ← دور، ضمن `organization_id` إلزامي، مع `organization_node_id` اختياري لنطاق أدق. |

*ملاحظة: تم إزالة نظام المجموعات (Groups, GroupRoles, UserGroups) وصلاحيات المجموعات (`groups.view`, `groups.manage`) بشكل دائم عبر الهجرة التصحيحية `20260826150000_remove_groups`.*

## مسار التفويض المعتمد

```
Users → UserRoles → Roles → RolePermissions → Permissions
```

يحسب `services/rbacService.ts::getEffectivePermissions(userId)` الصلاحيات حصرية من
`user_roles` المباشر.

## التحقق في الـ middleware

`middlewares/auth.ts::authorizePermission(code, nodeScopeResolver?)`:
1. يتحقق أن الكود موجود ضمن صلاحيات المستخدم الفعلية.
2. **إلزامي**: يتحقق من أن الصلاحية اكتُسبت ضمن السياق التنظيمي الصحيح — نطاق
   المؤسسة يأتي من تعيين الدور (`user_roles.organization_id`) ويجب أن يطابق
   `req.organizationId` — منع استخدام صلاحية اكتسبها المستخدم في مؤسسة "أ" على
   بيانات مؤسسة "ب" لمجرد كونه عضواً في كلتيهما. الصلاحيات نفسها (`permissions`)
   كتالوج نظامي مشترك لا تحمل `organization_id`.
3. اختياري: يتحقق من نطاق `organization_node_id` عبر محلّل العقدة الخاص بالمسار.

`authorize(...roleCodes)` القديم لا يزال يعمل (توافق خلفي) — يُفضَّل
`authorizePermission` لأي مسار جديد.

## قواعد الملكية عند الإسناد

- لا يمكن إسناد دور لمستخدم غير عضو فعلياً في المؤسسة (`UserOrganization`) أولاً.
- الدور المُسنَد يجب أن يكون نظامياً أو مملوكاً لنفس المؤسسة تحديداً.
- لا يمكن إلغاء آخر `admin` في مؤسسة.
