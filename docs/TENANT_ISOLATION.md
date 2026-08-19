# Tenant Isolation Rules

## القاعدة الذهبية

`req.organizationId` هو المصدر **الوحيد** المعتمد. أي service يستقبل
`organizationId` كمعامل صريح من الـ controller (وليس من `req.body.organizationId`
أو مشابه). هذه القاعدة تنطبق على **أي وحدة أعمال مستقبلية**، وليس فقط CFMS.

## آلية التحديد (`middlewares/tenant.ts`)

| Middleware | يُستخدم في | كيف يُحدَّد `organizationId` |
|---|---|---|
| `resolvePublicTenant` | مسارات عامة (`/api/public/:orgSlug/...`) | من `organizations.slug` في الرابط. لا مصادقة. |
| `resolveAuthenticatedTenant` | كل المسارات الداخلية | من هيدر `X-Organization-Id` **بعد التحقق الفعلي** من عضوية المستخدم عبر `UserOrganization`، أو من عضويته الأساسية (`is_primary`) إن لم يُرسَل الهيدر. رفض صريح (403) عند محاولة انتحال مؤسسة. |

**لا يوجد مسار ثالث.** أي controller جديد (في CFMS أو أي وحدة مستقبلية) يحتاج
سياق مؤسسة يجب أن يستخدم أحد هذين.

## القاعدة العملية لأي service جديد

```js
// صحيح
const listX = async (organizationId, filters) => {
  return Model.findAll(withTenantScope(organizationId, { where: filters }));
};

// خطأ - لا يُقبل أبداً في مراجعة الكود
const listX = async (filters) => {
  return Model.findAll({ where: { ...filters, organizationId: filters.organizationId } });
};
```

استخدم `utils/tenantScope.js`:
- `withTenantScope(organizationId, options)` — يدمج `organizationId` في `where` قسراً.
- `assertBelongsToTenant(record, organizationId, message)` — بعد `findByPk`، يرمي
  **404** (وليس 403) لإخفاء وجود السجل من الأساس إن كان لمؤسسة أخرى.

## نمط Template + Override

مطبَّق على: `roles`, `groups`, `reference_lists`. القاعدة: `organization_id = NULL`
يعني سجلاً نظامياً متاحاً لكل المؤسسات؛ قيمة تعني مملوكاً لمؤسسة واحدة فقط.
عند التحقق من الملكية:

```js
where: { id, [Op.or]: [{ organizationId: null }, { organizationId }] }
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
