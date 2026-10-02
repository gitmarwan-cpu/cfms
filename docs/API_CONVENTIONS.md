# API Conventions

## صيغة الاستجابة

```json
// نجاح
{ "success": true, "data": ..., "message": "..." (اختياري) }

// قائمة مع ترقيم صفحات
{ "success": true, "data": [...], "pagination": { "total", "page", "limit", "totalPages" } }

// خطأ
{ "success": false, "message": "نص عربي واضح للمستخدم النهائي" }
```

في الإنتاج، لا تُعرض تفاصيل الأخطاء الداخلية (stack traces) أبداً.

## المصادقة

`Authorization: Bearer <JWT>` لكل المسارات الداخلية. لا Refresh Token حالياً
(توكن واحد صالح 8 ساعات — قيد معروف).

## تحديد المؤسسة (Tenant Context)

- مسارات عامة: عبر `:orgSlug` في الرابط.
- مسارات داخلية: هيدر اختياري `X-Organization-Id`. **لا يُقبل** `organizationId`
  في body/query أبداً.

## Operational endpoints

- `GET /api/audit-logs`: authenticated administrators only; returns audit events scoped to the active organization.
- `GET /api/notifications`: authenticated users receive only their own notifications in the active organization.
- `PATCH /api/notifications/:id/read`: marks one notification read only when it belongs to the authenticated user and active organization.
- `PATCH /api/complaints/:id/assignment`: requires `complaints.assign`. Accepts optional `assigneeUserId` and/or `assigneeOrganizationId` (nullable ints). Omitted/null values clear that side of the assignment; both null clears assignment. Assignees must be active tenant members; organization nodes must be active, non-deleted, and belong to the active organization.
- `GET /api/complaints/:id/transitions`: requires `complaints.assign` and returns only the workflow transitions currently defined for the complaint's current state within the active tenant context. This endpoint intentionally returns workflow truth only (it is not filtered by the caller's permission to perform each transition).
- `PATCH /api/complaints/:id/status`: requires `complaints.assign`; closing (target status `closed`) additionally requires `complaints.close`. Rejection transitions remain governed by `complaints.assign` alone. Transitions that are not defined from the complaint's current state are rejected with 409.
- `GET /api/reports/complaints`: requires `complaints.view_all` and returns tenant-scoped status/category/assignment/sensitivity/monthly aggregates. Optional `from` and `to` filters use `YYYY-MM-DD`. Assigned counts include individual or organization-node ownership.

## Complaint read visibility (implemented)

`GET /api/complaints` and `GET /api/complaints/:id` accept either `complaints.view_all` or
`complaints.view_own` for the active organization. Data scope is resolved server-side from
trusted RBAC data only (`req.user.permissions[].organizationId` / `.orgUnitId` plus the
authenticated user id) — never from query parameters, body, URL parameters or client headers.

| Granted scope | Visible complaints |
|---|---|
| `complaints.view_all` without a node | every complaint of the active tenant |
| `complaints.view_all` with `organization_node_id = N` | complaints assigned to node `N` only (exact node; no subtree traversal) |
| `complaints.view_own` without a node | complaints assigned directly to the authenticated user |
| `complaints.view_own` with `organization_node_id = N` | assigned-to-me **plus** node `N` |
| unassigned complaints (`assigned_to_organization_id IS NULL`) | `complaints.view_all` holders only |

- Multiple role assignments are combined as a union: `view_all` ∪ allowed node scopes ∪ `view_own`.
- List and detail use the same visibility predicate: any complaint reachable through
  `GET /:id` is also present in the list for the same user and scope.
- An out-of-scope complaint returns the existing **404** (never 403) through `GET /:id` and
  through `GET /:id/attachments/:attachmentId` — the tenant-isolation/existence-hiding
  contract is preserved (`docs/TENANT_ISOLATION.md`).
- A caller without any complaint read permission is still rejected with 403 (route level).
- Mutation paths (`PATCH /:id/assignment`, `PATCH /:id/status`, `POST /:id/escalate`,
  `POST /:id/regenerate-pin`) and `GET /:id/transitions` remain unchanged: they stay
  tenant-scoped under their own permissions (`complaints.assign`, `complaints.close`,
  `complaints.escalate`). Node scoping of workflow/mutation paths is a separate future concern.

## Rate Limiting

مُفعَّل حالياً على: `POST /auth/login`, `POST /public/:orgSlug/complaints`,
`POST /public/:orgSlug/complaints/track`. أي مسار عام جديد حسّاس يجب أن يحصل
على Rate Limiter مخصص قبل الدمج.

## التحقق (Validation)

القيم من قوائم مرجعية تُتحقَّق عبر `custom(isActiveReferenceCode(listKey))` —
**ليس** `isIn([...قيم ثابتة])`.

## رفع الملفات

حد 5MB، حتى 3 ملفات، أنواع مسموحة مُتحقَّقة عبر `mimetype`، والامتداد المُخزَّن
يُشتق من خريطة ثابتة (**وليس** من اسم الملف الذي يرسله العميل).
