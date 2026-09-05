# Project Status Snapshot

## Current Status — Phase 3 Admin UI hardening (2026-08-27)

Phase 3 admin UI hardening is implemented in the current working tree: route
visibility and actions use backend permissions, complaint status actions consume
backend-defined transitions, and complaint assignment remains limited to a user
or organization node. Groups have been permanently removed and are not part of
the effective authorization model or complaint assignment.

Phase B (SLA & Escalation) is fully implemented, hardened, and verified on the backend:

1. **SLA Architecture & Priority Support**:
   - `sla_rules` model created with matching fields (`complaint_type`, `category_item_id`, `priority_item_id`, `is_sensitive`).
   - Priority matching integrated into complaint submission and SLA rule resolution via `priority` reference list (`low`, `medium`, `high`, `urgent`).
   - Rule specificity scoring algorithm ensures exact matches take precedence over generic fallback rules.

2. **Automated Escalation & Idempotency**:
   - `complaint_escalation_events` table tracks all manual and automated escalation steps.
   - Background SLA evaluation worker (`backend/src/workers/slaWorker.ts`) integrated into server lifecycle.
   - Idempotent escalation persistence (`escalation_level: { lt: toLevel }`) ensures zero duplicate escalation events or notifications during concurrent worker cycles or race conditions.

3. **Backend Test & Quality Verification**:
   - Complete Jest backend test suite passes with **19 test suites** and **155 tests** on isolated PostgreSQL test database `cfms_test`.
   - `cfms_db` was inspected read-only and was **not** modified.
   - Known Phase B limitations documented in [`docs/SLA.md`](./SLA.md) (24/7 UTC continuous hours calculation, in-process worker, production migration history reconciliation pending for `cfms_db`).

## Units (Routes) Currently Active

| Route | Purpose | Auth / Scope |
|---|---|---|
| `/api/auth` | Login, staff creation | Mixed |
| `/api/public/:orgSlug/...` | Public portal: branding, reference data, complaint submit/track | Public |
| `/api/complaints` | Complaint lifecycle, assignment, status update, manual escalation | Authenticated + Tenant |
| `/api/sla-rules` | SLA rule management (create, update, list, detail) | Authenticated + Tenant (`organization.manage`) |
| `/api/reports` | Complaint summary report endpoint | Authenticated + Tenant |
| `/api/organization` | Own organization configuration | Authenticated + Tenant |
| `/api/org-structure` | Organization node types; canonical nodes are under `/api/organization/nodes` | Authenticated + Tenant |
| `/api/reference-data` | Reference list & item management | Authenticated + Tenant |
| `/api/roles` | Role & permission management | Authenticated + Tenant |
| `/api/users` | User role assignment | Authenticated + Tenant |
| `/api/locations` | Governorates & districts (geographic reference) | Public |

## Models Currently Implemented — 23 Models

- **Multi-Tenant Foundation**: `Organization`, organization nodes/types, `UserOrganization`.
- **RBAC**: `Role`, `Permission`, `RolePermission`, `UserRole` (Groups subsystem permanently removed).
- **Users & Complainants**: `User`, `Complainants`.
- **Complaints & SLA**: `Complaints`, `ComplaintAttachment`, `ComplaintStatusHistory`, `SlaRule`, `ComplaintEscalationEvent`.
- **Reference Data**: `ReferenceList`, `ReferenceListItem`.
- **Geography**: `Country`, `Governorate`, `District`.
- **Platform Infrastructure**: `AuditLog`, `Notification`.

## Verification Status

All 19 test suites and 155 tests pass cleanly against `cfms_test`. Backend TypeScript compilation, `prisma validate`, frontend `npm run typecheck`, frontend `npm run build`, and `git diff --check` all complete with zero errors.

**تعدد المؤسسات**: `Organization`, عقد تنظيمية وأنواعها، `UserOrganization`.
**RBAC**: `Role`, `Permission`, `RolePermission`, `UserRole` (نظام المجموعات أُزيل بالكامل).
**المستخدمون**: `User` (نظام)، `Complainant` (عام، منفصل تماماً).
**الشكاوى**: `Complaint`, `ComplaintAttachment`, `ComplaintStatusHistory`.
**البيانات المرجعية**: `ReferenceList`, `ReferenceListItem`.
**الجغرافيا**: `Country`, `Governorate`, `District`.

## الاختبارات

33 migrations، 8 ملفات اختبار (`auth`, `complaints`, `locations`, `organization`,
`referenceData`, `security`, `tenantIsolation` + `setup`).
الاختبارات الحالية تعمل على PostgreSQL المعزول `cfms_test` عبر Prisma؛ أي إشارة
لاحقة إلى SQLite تصف البنية التاريخية فقط.

## المراجعات المكتملة

- ✅ مراجعة أمنية منهجية شاملة (tenant isolation, RBAC, rate limiting, رفع
  ملفات) — ثغرتان حقيقيتان مُصلحتان + 4 إصلاحات إضافية (Rate Limiting، امتداد
  الملفات، توحيد 404/403، تحقق ملكية `managerUserId`، وتحقق ملكية النوع
  المُشار إليه في `allowedParentTypeId` — قيد تحقق تنفيذي حالي في طبقة الخدمة
  لوضع العُقد التنظيمية (node-type placement validation)، وليس ثابتاً
  معمارياً).
- ✅ تحقق حي متكرر على PostgreSQL حقيقي (وليس فقط بنية SQLite التاريخية) لكل تغيير مخطط منذ
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
