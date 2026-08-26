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
- `GET /api/complaints/:id/transitions`: requires `complaints.assign` and returns only the workflow transitions currently defined for the complaint's current state within the active tenant context.
- `GET /api/reports/complaints`: requires `complaints.view_all` and returns tenant-scoped status/category/assignment/sensitivity/monthly aggregates. Optional `from` and `to` filters use `YYYY-MM-DD`. Assigned counts include individual or organization-node ownership.

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
