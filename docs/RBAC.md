# RBAC — Roles, Permissions, Groups

هذه الوحدة جزء من **Core Platform** (وليست خاصة بـ CFMS) — أي وحدة أعمال
مستقبلية تستخدم نفس النظام دون تعديل.

## الجداول

| جدول | الغرض |
|---|---|
| `permissions` | كتالوج نظامي بالكامل (مشترك بين كل المؤسسات دوماً). لا Template+Override هنا. |
| `roles` | Template+Override. `is_system=true` (admin/staff) لا يمكن حذفه/تعديله. |
| `role_permissions` | جسر m:n بين دور وصلاحياته. |
| `groups` | Template+Override. آلية توزيع أدوار على عدة مستخدمين دفعة واحدة. **بلا توريث حالياً**. |
| `group_roles` | جسر m:n بين مجموعة وأدوارها. |
| `user_roles` | إسناد مباشر: مستخدم ← دور، ضمن `organization_id` إلزامي، مع `org_unit_id` اختياري لنطاق أدق. |
| `user_groups` | عضوية: مستخدم ← مجموعة، ضمن `organization_id` إلزامي. |

## مساران متوازيان، لا يُلغي أحدهما الآخر

```
                    Permissions
                        ▲
                        │ (via role_permissions)
                      Roles
                    ▲         ▲
                    │         │
              UserRoles    GroupRoles
                    │         │
                  Users ──► UserGroups ──► Groups
```

يُحسب كلاهما في `services/rbacService.ts::getEffectivePermissions(userId)`
ويُدمَجان في مصفوفة واحدة. كل صلاحية موسومة بـ `{ code, organizationId, orgUnitId }`.

## التحقق في الـ middleware

`middlewares/auth.ts::authorizePermission(code, resolveOrgUnitId?)`:
1. يتحقق أن الكود موجود ضمن صلاحيات المستخدم الفعلية.
2. **إلزامي**: يتحقق أن `permission.organizationId === req.organizationId` — منع
   استخدام صلاحية اكتسبها المستخدم في مؤسسة "أ" على بيانات مؤسسة "ب" لمجرد
   كونه عضواً في كلتيهما.
3. اختياري: تحقق `org_unit_id` عبر `resolveOrgUnitId(req)`.

`authorize(...roleCodes)` القديم لا يزال يعمل (توافق خلفي) — يُفضَّل
`authorizePermission` لأي مسار جديد.

## قواعد الملكية عند الإسناد

- لا يمكن إسناد دور/مجموعة لمستخدم غير عضو فعلياً في المؤسسة (`UserOrganization`) أولاً.
- الدور/المجموعة المُسنَدة يجب أن تكون نظامية أو مملوكة لنفس المؤسسة تحديداً.
- لا يمكن إلغاء آخر `admin` في مؤسسة.
- لا حذف/تعديل للأدوار والمجموعات النظامية — يُعاد **403** (موجودة، ممنوع
  تعديلها) بخلاف مورد من مؤسسة أخرى الذي يُعاد له **404** (لإخفاء وجوده).

## التوسع المستقبلي: توريث المجموعات

قرار مؤجَّل عمداً. عند الحاجة: جدول `group_implied_groups` (m:n، `group_id` ←
`implied_group_id`) **منفصل**، دون أي migration تعديلية على `groups` نفسها،
مطابقاً لـ `implied_ids` في Odoo.
