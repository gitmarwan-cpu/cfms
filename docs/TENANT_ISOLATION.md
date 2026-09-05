# Tenant Isolation Rules

## القاعدة الذهبية

`req.organizationId` هو المصدر **الوحيد** المعتمد. أي service يستقبل
`organizationId` كمعامل صريح من الـ controller (وليس من `req.body.organizationId`
أو مشابه). هذه القاعدة تنطبق على **أي وحدة أعمال مستقبلية**، وليس فقط CFMS.

## آلية التحديد (`middlewares/tenant.ts`)

| Middleware | يُستخدم في | كيف يُحدَّد `organizationId` |
|---|---|---|
| `resolvePublicTenant` | مسارات عامة (`/api/public/:orgSlug/...`) | من `organizations.slug` في الرابط. لا مصادقة. |
| `resolveAuthenticatedTenant` | كل المسارات الداخلية | من هيدر `X-Organization-Id` **بعد التحقق الفعلي** من وجود عضوية نشطة للمستخدم في تلك المؤسسة عبر `user_organizations` (`UserOrganization`)، أو — إن لم يُرسَل الهيدر — من `users.default_organization_id` مع التحقق من وجود عضوية نشطة لنفس المؤسسة. رفض صريح (403) عند محاولة انتحال مؤسسة. |

**لا يوجد مسار ثالث.** أي controller جديد (في CFMS أو أي وحدة مستقبلية) يحتاج
سياق مؤسسة يجب أن يستخدم أحد هذين.

## القاعدة العملية لأي service جديد (Prisma)

الـ controller يمرر السياق الموثوق `req.organizationId` كمعامل صريح للـ service،
والـ service يستخدمه في كل استعلامات Prisma ولا يقرأ أي `organizationId` من
body/query:

```ts
// صحيح
const listX = async (organizationId: OrganizationId, filters: Filters) => {
  return prisma.x.findMany({
    where: { organization_id: Number(organizationId), ...filters },
  });
};

// خطأ - لا يُقبل أبداً في مراجعة الكود
const listX = async (filters: Filters) => {
  return prisma.x.findMany({ where: { ...filters, organization_id: filters.organizationId } });
};
```

عند جلب/تعديل سجل واحد، اجلبه بشرط النطاق داخل الاستعلام نفسه ثم أرجع **404**
(وليس 403) إن لم يوجد — لإخفاء وجود سجل مؤسسة أخرى من الأساس:

```ts
const record = await prisma.x.findFirst({
  where: { id: parsedId, organization_id: parsedOrganizationId },
});
if (!record) throw new ApiError(404, NOT_FOUND);
```

### نطاق عُقد التنظيم (Organization Nodes)

عُقد الهيكل التنظيمي صفوف داخل `organizations` نفسها (النموذج المعتمد موثق في
`modules/organizations/README.md`: الجذر `root_organization_id = NULL`، وكل
وحدة تحمل `root_organization_id` معرّف الجذر — مرجع دائم لحدود المستأجر). النمط
المنفَّذ فعلياً في الخدمات (`organizationService`, `complaintService`,
`userRoleService`):

```ts
// 1) اشتق جذر المؤسسة من السياق الموثوق — وليس من العميل
//    (resolveRootOrgId داخل organizationService)
const rootOrgId = await resolveRootOrgId(req.organizationId);

// 2) scope عمليات العقد إلى الجذر: العقدة الجذر نفسها أو أي وحدة تتبعها
await prisma.organizations.findFirst({
  where: {
    id: parsedNodeId,
    deleted_at: null,
    OR: [{ id: rootOrgId }, { root_organization_id: rootOrgId }],
  },
});
```

لا يجوز تمرير معرف مؤسسة أو عقدة قادم من body/query إلى هذه المسارات — السياق
الوحيد المعتمد هو `req.organizationId` بعد التحقق من العضوية.

## نمط Template + Override

مطبَّق على: `roles`, `reference_lists`. نظام Groups أُزيل نهائياً عبر `20260826150000_remove_groups`؛
أصبح التفويض مباشراً عبر `user_roles` فقط. القاعدة: `organization_id = NULL` يعني
سجلاً نظامياً متاحاً لكل المؤسسات؛ قيمة تعني مملوكاً لمؤسسة واحدة فقط.
عند التحقق من الملكية:

```js
where: { id, OR: [{ organization_id: null }, { organization_id: parsedOrganizationId }] }
```

## ثغرتان حقيقيتان اكتُشفتا وأُصلحتا (أمثلة تعليمية، لا تُكرَّر)

1. **`orgUnitRoutes`**: كانت تأخذ `organizationId` من `req.params.organizationId`
   في الرابط مباشرة — أي مستخدم مصادَق عليه كان يستطيع تغيير الرقم والوصول
   لهيكل مؤسسة أخرى. **الدرس**: لا تضع `organizationId` في URL params لمسارات
   إدارية إطلاقاً.
2. **`PUT /api/organization/:id`**: كانت تقبل `id` من العميل دون تحقق ملكية.
   **الدرس**: مسار "تعديل إعدادات مؤسستي" لا يحتاج أي معرّف في الرابط أصلاً.

## اختبار العزل إلزامي لأي وحدة جديدة

راجع `backend/tests/tenantIsolation.test.js` كنموذج: لكل موديل جديد مملوك
لمؤسسة، اختبر أن مؤسسة "أ" لا يمكنها القراءة/التعديل/الحذف على بيانات مؤسسة
"ب"، ولا انتحال هويتها عبر الهيدر.
