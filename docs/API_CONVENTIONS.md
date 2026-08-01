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
