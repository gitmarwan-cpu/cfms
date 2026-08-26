# CFMS Platform — Development Roadmap

> يدمج هذا الملف خارطة الطريق الأصلية مع الرؤية طويلة المدى للمنصة كنظام
> ERP-style قابل للتوسع. الحالة (✅ منجز / 🔶 قيد التنفيذ / ⏳ مخطَّط) مُحدَّثة
> لتطابق الكود الفعلي عند آخر مراجعة موثقة (HEAD `685ec95`) — **وليست** الحالة
> الأصلية في نسخة `Roadmap.md` المرفقة سابقاً، والتي أصبحت متجاوَزة جزئياً.

## Phase 0 — Foundation Stabilization ✅ منجز

- بنية المشروع، Backend (Express+Prisma)، Frontend (React+Vite)، قاعدة
  البيانات الأساسية، Git workflow.

## Phase 1 — Core Platform Completion 🔶 قيد التنفيذ (متقدّم جداً)

### 1.1 Reference Data Framework ✅ منجز (بنية عامة، وليس جداول منفصلة لكل نوع)

**تصحيح مهم عن الوصف الأصلي**: البند الأصلي افترض جداول/كيانات منفصلة لكل نوع
(Complaint Types, Categories, Channels, Priorities, Complainant Relationships).
الفعلي المبني **أعم وأصح هندسياً**: بنية واحدة عامة (`reference_lists`/
`reference_list_items`) بنمط Template+Override، تُستخدَم لكل هذه الأنواع دون
جداول منفصلة. راجع [`../docs/REFERENCE_DATA.md`](../docs/REFERENCE_DATA.md).

- ✅ Countries, Governorates, Districts (جداول جغرافية مخصَّصة، صحيح أن تبقى
  منفصلة لأنها هرمية جغرافياً وليست قوائم قيم بسيطة).
- ✅ Complaint Types, Categories, Channels, Priorities, Complainant Relationships
  (عبر البنية العامة أعلاه).
- ✅ CRUD, Activation/Deactivation عبر API إداري عام.
- ⏳ Soft Delete على البيانات المرجعية نفسها (موجود على بعض الجداول الأخرى، لا
  على `reference_lists`/`items` بعد).
- ⏳ Audit Logging عام (غير مبني بعد - راجع 1.8).

### 1.2 Organization Management ✅ منجز جزئياً

- ✅ Organization (متعددة، Multi-Tenant حقيقي، ليس مؤسسة واحدة فقط).
- ✅ الهيكل التنظيمي: عبر عقد `organizations` الهرمية (`parent_id`) وأنواع
  تنظيمية قابلة للتخصيص لكل مؤسسة، وليس جداول ثابتة منفصلة للفروع/الأقسام/الفرق.
- ✅ Organization Settings, Branding (شعار، ألوان، اسم)، Default Country.
- ⏳ Contact Information كحقول مخصَّصة أوسع (الأساسي موجود: phone/email/website).

### 1.3 User & Permission Management ✅ منجز

- ✅ Users, Roles, Permissions.
- 🔶 Groups remain as frozen compatibility data for migration/rollback; they are
  no longer part of effective authorization.
- ✅ User↔Organization Assignment (M:N حقيقي عبر `UserOrganization`، مستخدم
  واحد قد ينتمي لعدة مؤسسات بأدوار مختلفة).
- ✅ RBAC مع Data permissions (نطاق المؤسسة، مع تقييد اختياري بـ
  `organization_node_id`).

### 1.4 Authentication & Access Management 🔶 جزئي

- ✅ Staff Login/Logout, Protected Routes, Permission-based Navigation (Backend).
- ✅ Backend Authorization كامل.
- ⏳ Password Management (إعادة تعيين، تغيير ذاتي) — غير مبني بعد.
- ⏳ Session Management متقدّم (Refresh Tokens) — توكن واحد 8 ساعات فقط حالياً.
- ⏳ Login Audit — غير مبني بعد.

### 1.5 Workflow Engine 🔶 أساسي منفَّذ

يستخدم مسار الشكاوى الحالي تعريفاً افتراضياً وانتقالات مخزنة في
`workflow_definitions` و`workflow_transitions`. لا توجد بعد واجهة إدارة لتخصيص
التعريفات؛ لذلك لا ينبغي اعتبار المسار قابلاً للتخصيص من واجهة الإدارة حالياً.

### 1.6 File Management Foundation ✅ منجز (أساسي)

- ✅ Upload, Storage, Metadata (حجم/نوع/اسم مُخزَّن)، Access Control أساسي.
- ⏳ لا مسار تنزيل/عرض مرفقات بعد (راجع ملاحظة أمنية في مراجعة الأمان السابقة).

### 1.7 API Foundation ✅ منجز

راجع [`../docs/API_CONVENTIONS.md`](../docs/API_CONVENTIONS.md).

### 1.8 Audit & Activity System ✅ منجز (سجلات تدقيق كاملة للشكاوى والإسناد والمصادقة)

- ✅ `audit_logs` جدول تدقيق معزول لكل مؤسسة يدعم التتبع الدقيق لجميع العمليات وإعادة التعيين والتصعيد وتغييرات الحالة.

## Phase 2 — Complaint Management Module (CFMS) 🔶 قيد التنفيذ (مكتمِل الهيكل والـ Backend)

راجع [`../modules/complaints/README.md`](../modules/complaints/README.md)
للتفاصيل الكاملة وحالة كل بند.

- ✅ 2.1 Complaint Submission (عام، مجهول، مرفقات، PIN، ربط اختياري بمشروع/موظف كنص حر، وأولوية).
- ✅ 2.2 SLA & Escalation Management (قواعد اتفاقيات مستوى الخدمة، التصعيد الآلي، خادم الخلفية، وحساب المهلة الزمنية حسب الأولوية).
- ✅ 2.3 Complaint Assignment (إسناد إلى مستخدم أو عقدة تنظيمية اختيارياً مع تحقق عضوية/نطاق المؤسسة ومسار تدقيق؛ Groups مخصصة لتجميع الأدوار وليست جهات تعيين للشكاوى).
- ✅ 2.4 Reporting Summary API (`GET /api/reports/complaints` تفصيلي مع الإحصائيات والأولويات والتوزيعات).
- ✅ 2.5 Public Tracking (رقم مرجعي + PIN، عرض مبسَّط آمن).

## Phase 3 — Platform Extensions ⏳ مخطَّط

- Notification Engine (Email/SMS/WhatsApp/In-app).
- Reporting Engine (Dashboards/Export/Analytics).

## Phase 4 — Additional Business Modules ⏳ مخطَّط (رؤية طويلة المدى)

بعد اكتمال Core Platform، المنصة مصمَّمة لاستيعاب أي عدد من وحدات الأعمال دون
إعادة تصميم الأساس. القائمة أدناه توضيحية وليست شاملة أو نهائية:

**الأساس المشترك (Core Platform)**: Authentication, Organizations, Branches,
Departments, Teams, Users, Roles & Permissions, Workflow Engine, Notification
Engine, Audit Trail, File Management, Dashboard Framework, AI Services,
Reporting Engine.

**وحدات الأعمال (Business Modules)**:
- Complaints & Feedback Management (**الوحدة الأولى الحالية، الأكثر نضجاً**)
- Human Resources (HR)
- Project Management
- Planning & Strategic Planning
- Monitoring & Evaluation (M&E)
- Grants & Donor Management
- Procurement
- Inventory & Warehouse
- Asset Management
- Finance & Accounting
- CRM
- Help Desk
- Document Management
- Knowledge Base
- Risk Management
- Quality Management
- Meetings Management
- Tasks & Activities
- Internal Requests
- Employee Self-Service
- Training Management
- Performance Management

القائمة مفتوحة لأي وحدة مستقبلية إضافية دون قيد.

## Definition of Done

أي Phase/بند لا يُعتبر مكتملاً إلا إذا:

- Database updated with migrations and verified on real PostgreSQL, including the
  disposable migration-validation database (see [`../docs/DATABASE_CONVENTIONS.md`](../docs/DATABASE_CONVENTIONS.md)).
- API documented.
- Tests passing.
- Frontend integrated.
- Documentation updated (هذا الملف ووثائق `docs/`/`modules/` ذات الصلة).
- RBAC verified.
- Tenant isolation verified (مع اختبار عزل فعلي، راجع `tenantIsolation.test.js`).
- Security reviewed.
- Performance reviewed.
