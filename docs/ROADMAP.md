# CFMS Platform — Development Roadmap

> يحدد هذا الملف خارطة الطريق الحالية لمنصة CFMS، مع الحفاظ على رؤية طويلة المدى لمنصة مؤسسية قابلة للتوسع وإضافة وحدات أعمال مستقبلية.
>
> الحالة: ✅ منجز / 🔶 قيد التنفيذ / ⏳ مخطَّط

## Phase 0 — Foundation Stabilization ✅ منجز

- بنية المشروع الأساسية.
- Backend باستخدام Express + TypeScript + Prisma.
- Frontend باستخدام React + TypeScript + Vite.
- PostgreSQL كقاعدة البيانات الأساسية.
- Git workflow.
- أساسيات الاختبارات والبنية المشتركة.

---

## Phase 1 — Core Platform Completion 🔶 قيد التنفيذ

### 1.1 Reference Data Framework ✅ منجز

بنية مرجعية عامة تعتمد على:

`reference_lists` / `reference_list_items`

بدلاً من إنشاء جدول منفصل لكل نوع من البيانات المرجعية.

- ✅ Complaint Types
- ✅ Categories
- ✅ Channels
- ✅ Priorities
- ✅ Complainant Relationships
- ✅ Countries
- ✅ Governorates
- ✅ Districts
- ✅ CRUD عبر API إداري عام
- ✅ Activation / Deactivation
- ⏳ Soft Delete للبيانات المرجعية
- ⏳ استكمال التكامل مع جميع الوحدات التي تحتاج بيانات مرجعية

---

### 1.2 Organization Management 🔶 قيد التنفيذ

CFMS يستخدم نموذجًا تنظيميًا هرميًا موحدًا يعتمد على جدول:

`organizations`

وتُحدد طبيعة العقدة التنظيمية بواسطة:

`org_unit_type_id → org_unit_types`

بدلاً من إنشاء جداول منفصلة للـ Branches أو Departments أو Sectors أو Teams.

يدعم النموذج:

- ✅ Organizations
- ✅ Multiple root organizations
- 🔶 Parent / Child hierarchy
- 🔶 Configurable organizational unit types
- 🔶 Organizational membership
- 🔶 Default user organization
- ⏳ Organization settings
- ⏳ Branding
- ⏳ Contact information
- ⏳ Hierarchy validation and cycle prevention
- ⏳ تحسين إدارة organizational context

`users.organization_id` يمثل المنظمة الافتراضية للمستخدم، بينما:

`user_organizations`

يمثل عضوية المستخدم في المؤسسات والعقد التنظيمية المختلفة.

> التنظيم المؤسسي يحدد السياق، بينما RBAC يحدد الصلاحيات.

---

### 1.3 User & Permission Management ✅ منجز

- ✅ Users
- ✅ Roles
- ✅ Permissions
- ✅ User ↔ Organization membership
- ✅ User ↔ Role assignment
- ✅ Permission-based authorization
- ✅ Backend authorization
- ✅ Organizational context support

يجب الحفاظ على RBAC الحالي وإعادة استخدامه دون إعادة تصميمه أثناء تطوير الهيكل التنظيمي.

---

### 1.4 Authentication & Access Management 🔶 قيد التنفيذ

- ✅ Staff Login / Logout
- ✅ Protected Routes
- ✅ Permission-based navigation
- ✅ Backend authorization
- ⏳ Password change
- ⏳ Password reset
- ⏳ Refresh token / session management
- ⏳ Login and authentication audit improvements
- ⏳ Security hardening

---

### 1.5 Workflow Engine ⏳ مخطَّط

تحويل workflow من الحالة الحالية المعتمدة على حالات ثابتة إلى محرك Workflow قابل للتخصيص.

المستهدف:

- Workflow Definitions
- Workflow States
- Workflow Transitions
- Role / Permission-based transitions
- Organizational rules
- Validation
- History and audit
- Module-specific workflows

---

### 1.6 File Management Foundation 🔶 قيد التنفيذ

- ✅ File upload
- ✅ Storage
- ✅ File metadata
- ✅ Basic access control
- ⏳ Secure download / preview
- ⏳ File access authorization
- ⏳ File lifecycle management
- ⏳ Additional security validation

---

### 1.7 API Foundation ✅ منجز

- ✅ REST API structure
- ✅ Authentication middleware
- ✅ Authorization middleware
- ✅ Validation
- ✅ Consistent responses
- ✅ Error handling
- ✅ API conventions

راجع:

`docs/API_CONVENTIONS.md`

---

### 1.8 Audit & Activity System 🔶 قيد التنفيذ

- ✅ `audit_logs`
- ✅ Complaint activity auditing
- ✅ Assignment auditing
- ✅ Status change auditing
- ✅ Escalation auditing
- ✅ Authentication-related auditing
- ⏳ Expand auditing across Core Platform modules
- ⏳ Administrative activity views

---

## Phase 2 — Complaint Management Module 🔶 قيد التنفيذ

CFMS Complaints & Feedback Management هو أول Business Module في المنصة والأكثر نضجًا حاليًا.

### 2.1 Complaint Submission ✅ منجز

- ✅ Public submission
- ✅ Anonymous submission
- ✅ Reference number
- ✅ PIN
- ✅ Attachments
- ✅ Priority
- ✅ Optional project / staff information
- ✅ Validation

### 2.2 Complaint Lifecycle 🔶 قيد التنفيذ

- ✅ Complaint status management
- ✅ Assignment
- ✅ Status history
- 🔶 Workflow integration
- ⏳ Advanced lifecycle rules

### 2.3 SLA & Escalation Management ✅ منجز

- ✅ SLA rules
- ✅ Priority-based SLA calculation
- ✅ Automatic escalation
- ✅ Escalation events
- ✅ Backend enforcement

### 2.4 Complaint Assignment ✅ منجز

- ✅ Individual assignment
- ✅ Organizational unit assignment
- ✅ Membership validation
- ✅ Organizational access validation
- ✅ Audit trail

### 2.5 Public Tracking ✅ منجز

- ✅ Reference number + PIN
- ✅ Secure public tracking
- ✅ Limited public information exposure

### 2.6 Reporting Summary API ✅ منجز

- ✅ Complaint statistics
- ✅ Priority distribution
- ✅ Status distribution
- ✅ Organizational distributions
- ⏳ Advanced reporting and analytics

---

## Phase 3 — Platform Extensions ⏳ مخطَّط

### Notification Engine

- Email
- SMS
- WhatsApp
- In-app notifications
- Notification templates
- Event-based notifications
- Organizational configuration

### Reporting & Analytics Engine

- Dashboards
- Reports
- Filters
- Exports
- Organizational reporting
- Performance indicators
- Scheduled reports

### Dashboard Framework

- Reusable KPI components
- Charts
- Configurable filters
- Organizational views
- Module dashboards
- Export and printing support

---

## Phase 4 — Additional Business Modules ⏳ مخطَّط

CFMS is designed to evolve into a broader enterprise platform where future business modules reuse the same Core Platform services.

### Core Platform

Shared capabilities include:

- Authentication
- Organizations
- Organizational hierarchy
- Users
- Roles & Permissions
- Workflow Engine
- Notification Engine
- Audit Trail
- File Management
- Reporting Engine
- Dashboard Framework
- Shared Reference Data
- Shared Validation and Security Services

### Business Modules

Potential future modules include:

- Complaints & Feedback Management
- Human Resources
- Project Management
- Planning & Strategic Planning
- Monitoring & Evaluation
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

The list is indicative and may evolve according to organizational requirements.

---

## Phase 5 — Enterprise Capabilities ⏳ مخطَّط

Long-term capabilities may include:

- Advanced integrations
- External APIs
- Mobile applications
- Advanced analytics
- Automation
- AI-assisted services
- Enterprise reporting
- Multi-language support
- Advanced configuration
- Cross-module workflows

These capabilities should be introduced only after the underlying platform services are sufficiently stable.

---

## Definition of Done

A feature or phase is considered complete when applicable requirements are satisfied:

- Database changes are implemented through safe migrations.
- Changes are verified against PostgreSQL.
- API contracts are implemented and documented.
- Automated tests are passing.
- Frontend integration is complete where applicable.
- Documentation is updated.
- RBAC and authorization are verified.
- Organizational access and scope are verified where applicable.
- Security implications are reviewed.
- Performance implications are reviewed where applicable.
- Existing functionality remains stable.

Production data and applied migrations must not be modified to hide inconsistencies.

---

## Development Priorities

CFMS development follows these priorities:

1. **Security**
2. **Data integrity**
3. **Organizational integrity**
4. **Reliability**
5. **Maintainability**
6. **Testability**
7. **Performance**
8. **User experience**
9. **Extensibility**

New capabilities should build on existing Core Platform services rather than duplicate them.

---

## Development Flow

```text
Inspect
  ↓
Understand
  ↓
Define Target
  ↓
Plan
  ↓
Implement
  ↓
Test
  ↓
Verify
  ↓
Document