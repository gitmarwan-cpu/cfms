# Module: Users & Permissions

جزء من **Core Platform**. التفاصيل التقنية الكاملة في
[`../../docs/RBAC.md`](../../docs/RBAC.md) — هذا الملف يغطي الجانب الوظيفي فقط.

## الفصل الجوهري: مستخدمو النظام مقابل مقدّمي الطلبات

- **مستخدمو النظام** (`User`): موظفون داخليون فقط، لهم حساب وكلمة مرور
  ويسجّلون الدخول. لا يوجد تسجيل ذاتي عام — يُنشئهم مستخدم يملك صلاحية
  `users.manage` ضمن مؤسسته.
- **مقدّمو الطلبات** (`Complainant`): عامة الناس، بلا حساب إطلاقاً، بلا
  تسجيل دخول. راجع [`../complaints/README.md`](../complaints/README.md).

## الأدوار والصلاحيات (RBAC)

المسار المعتمد لإسناد الصلاحيات مباشر فقط: `User→UserRole→Role→Permission`.
بيانات Groups وعضوياتها التاريخية محفوظة مؤقتاً للقراءة والتدقيق والترحيل، لكنها
مجمّدة ولا تمنح صلاحيات. راجع [`../../docs/RBAC.md`](../../docs/RBAC.md).

## الحالة مقابل `Roadmap.md`

| البند (1.3, 1.4) | الحالة |
|---|---|
| Users, Roles, Groups, Permissions | ✅ منجز |
| User Organization Assignment | ✅ منجز (M:N حقيقي) |
| RBAC, Data permissions (Scoped) | ✅ منجز |
| Staff Login/Logout | ✅ منجز |
| Password Management (إعادة تعيين) | ⏳ غير مبني |
| Session Management (Refresh Tokens) | ⏳ غير مبني |
| Protected Routes, Permission-based Navigation | ✅ منجز (Backend) |
| Login Audit | ⏳ غير مبني |
