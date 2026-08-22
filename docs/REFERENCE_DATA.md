# Reference Data — Template + Override

جزء من **Core Platform**، تستخدمه أي وحدة أعمال (CFMS اليوم، ووحدات مستقبلية
لاحقاً) دون بناء آلية خاصة بها.

## القاعدة

**ممنوع** أي قائمة قيم (تصنيفات، حالات، أنواع...) كثوابت في الكود. كل قائمة
قابلة للتخصيص تُدار عبر جدولين عامّين:

- `reference_lists`: `key` (مُعرِّف فريد نصي)، `organization_id` (NULL = نظامي/
  Template مشترك؛ قيمة = نسخة خاصة بمؤسسة/Override).
- `reference_list_items`: `code`, `label_ar`, `label_en`, `sort_order`,
  `is_active`, `is_default`, `meta` (JSON حر).

## آلية Copy-on-Write

أول مرة تُعدِّل فيها مؤسسة قائمة نظامية، يُستنسَخ الـ Template بالكامل (القائمة
+ عناصرها) إلى نسخة خاصة بتلك المؤسسة تلقائياً (`getOrCreateOwnList`)، دون
التأثير على النسخة النظامية أو أي مؤسسة أخرى. القراءة (`getEffectiveList`):
نسخة المؤسسة الخاصة إن وُجدت، وإلا النسخة النظامية.

## القوائم الموجودة حالياً (وحدة CFMS)

| `key` | Template نظامي؟ | ملاحظة |
|---|---|---|
| `gender` | نعم | على `Complainant` |
| `age_group` | نعم | على `Complainant` |
| `complaint_category` | لا | قابلة للتخصيص الكامل من البداية |
| `channel` | لا | |
| `complaint_type` | نعم | complaint / proposal |
| `priority` | لا | تحمل `meta.color` |
| `complainant_relationship` | لا | 8 قيم Bootstrap، على `Complainant` |

## ⚠️ فخ حقيقي وقعنا فيه مرتين: seeders الجديدة

`sequelize-cli` **لا يتتبّع الـ seeders المُنفَّذة افتراضياً** — `db:seed:all`
يُعيد تشغيل كل ملف في كل مرة. لذلك:

1. **كل seeder جديد يجب أن يحمل حارس idempotency خاصاً به** (فحص `COUNT(*)`
   على شرط محدد بدقة)، وليس الاعتماد على ترتيب التشغيل.
2. **لا تُضِف قائمة جديدة داخل `seed-reference-data.js` الموجود** — له حارس
   شامل ("إن وُجدت أي قائمة نظامية، تخطَّ الملف بالكامل"). **أنشئ seeder
   مستقلاً** بحارس خاص بمفتاحه هو فقط (مثال: `seed-complainant-relationship.js`).

## إضافة قائمة مرجعية جديدة — الخطوات الصحيحة

1. Migration إن احتجت عمود FK جديد يشير إليها، nullable دائماً ما لم يكن هناك
   سبب قوي للإلزام.
2. Seeder **مستقل** بحارس idempotency خاص بـ `key` هذه القائمة تحديداً.
3. لا حاجة لأي endpoint جديد — `routes/referenceDataRoutes.js` و`publicRoutes.js`
   عامّان لأي `key` تلقائياً.
4. Frontend: أضف الـ `key` لمصفوفة الاستهلاك، ولا تكتب القيم مباشرة في الواجهة.
