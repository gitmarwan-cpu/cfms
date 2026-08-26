# Project Status Snapshot

## Current Status — Phase B Complete (2026-08-17)

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
   - Complete Jest backend test suite passes with **18 test suites** and **116 tests** on isolated PostgreSQL test database `cfms_test`.
   - `cfms_db` was inspected read-only and was **not** modified.
   - Known Phase B limitations documented in [`docs/SLA.md`](./SLA.md) (24/7 UTC continuous hours calculation, in-process worker, production migration history reconciliation pending for `cfms_db`).

## Units (Routes) Currently Active

| Route | Purpose | Auth / Scope |
|---|---|---|
| `/api/auth` | Login, staff creation | Mixed |
| `/api/public/:orgSlug/...` | Public portal: branding, reference data, complaint submit/track | Public |
| `/api/complaints` | Complaint lifecycle, assignment, status update, manual escalation | Authenticated + Tenant |
| `/api/sla-rules` | SLA rule management (create, update, list, detail) | Authenticated + Tenant (`sla.manage`) |
| `/api/reports` | Complaint summary report endpoint | Authenticated + Tenant |
| `/api/organization` | Own organization configuration | Authenticated + Tenant |
| `/api/org-structure` | Organizational structure (units + types) | Authenticated + Tenant |
| `/api/reference-data` | Reference list & item management | Authenticated + Tenant |
| `/api/roles` | Role & permission management | Authenticated + Tenant |
| `/api/groups` | Group management | Authenticated + Tenant |
| `/api/users` | User role/group assignment | Authenticated + Tenant |
| `/api/locations` | Governorates & districts (geographic reference) | Public |

## Models Currently Implemented — 23 Models

- **Multi-Tenant Foundation**: `Organization`, `OrgUnit`, `OrgUnitType`, `UserOrganization`.
- **RBAC**: `Role`, `Permission`, `RolePermission`, `UserRole`, `Group`, `GroupRole`, `UserGroup`.
- **Users & Complainants**: `User`, `Complainants`.
- **Complaints & SLA**: `Complaints`, `ComplaintAttachment`, `ComplaintStatusHistory`, `SlaRule`, `ComplaintEscalationEvent`.
- **Reference Data**: `ReferenceList`, `ReferenceListItem`.
- **Geography**: `Country`, `Governorate`, `District`.
- **Platform Infrastructure**: `AuditLog`, `Notification`.

## Verification Status

All 18 test suites pass cleanly against `cfms_test`. `npm run typecheck`, `npm run build`, and `git diff --check` all complete with zero errors.

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
الاختبارات الحالية تعمل على PostgreSQL المعزول `cfms_test` عبر Prisma؛ أي إشارة
لاحقة إلى SQLite تصف البنية التاريخية فقط.

## المراجعات المكتملة

- ✅ مراجعة أمنية منهجية شاملة (tenant isolation, RBAC, rate limiting, رفع
  ملفات) — ثغرتان حقيقيتان مُصلحتان + 4 إصلاحات إضافية (Rate Limiting، امتداد
  الملفات، توحيد 404/403، تحقق ملكية `managerUserId`/`allowedParentTypeId`).
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
