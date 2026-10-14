# Module: Complaints & Feedback (CFMS)

**الوحدة الأولى للمنصة، والأكثر نضجاً.** تعتمد بالكامل على الأساس المشترك
(Multi-Tenant, RBAC, Reference Data) الموثَّق في [`../../docs/`](../../docs/)
دون أي بناء موازٍ خاص بها.

## الكيانات (Models)

| الكيان | الغرض |
|---|---|
| `Complaint` | الشكوى/المقترح نفسه. مملوك لمؤسسة (`organization_id` إلزامي). |
| `Complainant` | هوية مقدّم الطلب — **منفصلة تماماً عن `User`**، بلا حساب. |
| `ComplaintAttachment` | مرفقات (حتى 3، صور/PDF، 5MB لكل ملف). |
| `ComplaintStatusHistory` | سجل تغييرات الحالة (من/إلى، ملاحظة، مَن غيّرها). |

### حقول حرة بلا FK (بقرار صريح، لتفادي بناء وحدات لم تُخطَّط بعد)

- `project_reference_code`: نص حر لمرجع مشروع. لا جدول `projects` بعد — عند
  بناء وحدة إدارة المشاريع، الترحيل هو إضافة `project_id` FK ونقل القيم عبر
  مطابقة نصية، دون كسر بيانات قائمة.
- `is_related_to_staff` + `related_staff_name` + `related_staff_position` +
  `staff_incident_details`: نص حر بلا FK لموظف حقيقي. الربط الفعلي بموظف من
  وحدة HR مستقبلية يتم يدوياً من الفريق الإداري لاحقاً.

## تدفّق تقديم الشكوى (الفعلي المبني اليوم)

```
Complainant submits complaint (public portal, /:orgSlug/complaints)
          |
          ↓
complaintService.createComplaint()
  - Resolve organizationId من resolvePublicTenant (slug) - ليس من body
  - Validate governorate/district pair
  - Resolve reference-data items (gender, age_group, relationship, category, channel)
  - Create Complainant (إن وُجدت أي بيانات هوية - راجع القاعدة أدناه)
          |
          ↓
Generate Complaint Reference Number (فريد، صيغة CFMS-YYYY-NNNNNN)
Generate Tracking PIN (6 أرقام، bcrypt hash فقط، يُعرض نصاً صريحاً مرة واحدة)
          |
          ↓
Response إلى المستفيد: { id, referenceCode, trackingPin }
```

### ⚠️ الفرق عن `Complaint_Module.md` الأصلي: لا Notification Engine بعد

المخطط الأصلي المرفق يصف خطوتين إضافيتين بعد توليد الرقم المرجعي/PIN:
**Notification Engine → WhatsApp Provider → إرسال رسالة تأكيد**. هاتان
الخطوتان **غير مبنيتين إطلاقاً حالياً** — لا يوجد Notification Engine ولا
تكامل WhatsApp في الكود. هذا مخطَّط ضمن Phase 3 في
[`../../docs/ROADMAP.md`](../../docs/ROADMAP.md)، وليس جزءاً من التدفّق الفعلي
اليوم. الاستجابة الوحيدة للمستفيد حالياً هي استجابة الـ API المباشرة (يعرضها
الـ Frontend فوراً)، بلا أي قناة تواصل خارجية.

## قاعدة إنشاء سجل Complainant

يُنشأ سجل `Complainant` فقط إن كانت الشكوى غير مجهولة **أو** حملت أي بيانات
هوية جزئية (اسم، هاتف، بريد، أو حتى "علاقة بالمؤسسة" وحدها بلا اسم). شكوى
مجهولة بالكامل بلا أي بيانات هوية لا تُنشئ سجل `Complainant` إطلاقاً
(`complainant_id = NULL`).

## قاعدة رقم الهاتف (منطق أعمال مُتحقَّق منه صراحة)

- الإفصاح عن الهوية (`isAnonymous=false`) ⇒ الهاتف **إلزامي**.
- الطلب المجهول (`isAnonymous=true`) ⇒ الهاتف **اختياري بالكامل دائماً** — لا
  يجوز أن يصبح إلزامياً عالمياً تحت أي ظرف.
- البريد الإلكتروني **اختياري دائماً** بصرف النظر عن `isAnonymous`، مع تحقق
  صيغة عادي إن وُجد.

## المتابعة العامة (Public Tracking)

`POST /:orgSlug/complaints/track` بالرقم المرجعي + PIN، بلا تسجيل دخول. يعيد
**فقط**: الحالة المبسَّطة (تم الاستلام/قيد المراجعة/تم الحل/أُغلقت)، تاريخ
الإرسال، آخر تحديث — **لا** أي تفاصيل داخلية (إسناد، ملاحظات، سجل إجراءات).

## حالة البنود مقابل `Roadmap.md`

| البند | الحالة |
|---|---|
| 2.1 Public/Anonymous submission, Attachments, Validation, Reference+PIN | ✅ منجز |
| 2.1 Notification trigger | ⏳ غير مبني (راجع أعلاه) |
| 2.2 Workflow Integration (Lifecycle/Timeline) | 🔶 مسار افتراضي وانتقالات مفعّلة؛ تخصيص التعريفات من الإدارة غير مبني بعد |
| 2.3 Assignment بمستخدم/عقدة تنظيمية/تصعيد | ✅ إسناد فردي + عقدة تنظيمية؛ Groups ليست جهات تعيين؛ التصعيد ضمن SLA لاحقاً |
| 2.4 Dashboard | ⏳ غير مبني |
| 2.5 Public Tracking | ✅ منجز |

## رؤية الشكاوى للموظفين — نطاق العقدة والملكية (مُنفَّذ)

تُشتق رؤية القراءة حصراً من بيانات RBAC الموثوقة (`user_roles.organization_id` /
`user_roles.organization_node_id` + هوية المستخدم)، ولا تُقرأ أبداً من query/body/headers.

| النطاق الممنوح                                      | الشكاوى المرئية                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `complaints.view_all` بلا عقدة                      | كل شكاوى المؤسسة                                                            |
| `complaints.view_all` مع `organization_node_id = N` | الشكاوى المسندة إلى العقدة `N` فقط (العقدة نفسها؛ لا اجتياز للشجرة الفرعية) |
| `complaints.view_own` بلا عقدة                      | الشكاوى المسندة مباشرة إلى المستخدم                                         |
| `complaints.view_own` مع `organization_node_id = N` | شكاوى المستخدم **زائد** شكاوى العقدة `N`                                    |
| الشكاوى غير المسندة                                 | لحاملي `complaints.view_all` فقط                                            |

- التعيينات المتعددة تُدمج بالاتحاد: `view_all` ∪ نطاقات العقد المسموحة ∪ `view_own`.
- القائمة (`GET /api/complaints`) والتفاصيل (`GET /api/complaints/:id`) تستخدمان نفس شرط
  الرؤية — أي شكوى يمكن الوصول لها بالمعرّف تظهر أيضاً في القائمة.
- الشكوى خارج النطاق → **404** (وليست 403) في التفاصيل وفي تحميل المرفقات، حفاظاً على
  عقد إخفاء الوجود.
- `GET /:id/transitions` يبقى مسار سير عمل بصلاحية `complaints.assign` (كما في مرحلة تفويض
  الإغلاق)، ومسارات التعديل/التصعيد تبقى ضمن نطاق المؤسسة دون تقييد عقد في هذه المرحلة.
- الصلاحيات المطلوبة للقراءة: `complaints.view_all` أو `complaints.view_own`؛ ومن لا يملك
  أي منهما يُرفض بـ 403.

## تفويض تغيير حالة الطلب (مُنفَّذ)

- `complaints.assign` يبقى الصلاحية الأساسية لكل تغيير حالة، ولقراءة الانتقالات
  (`GET /:id/transitions`)، وللإسناد (`PATCH /:id/assignment`).
- عند الانتقال إلى `resolved` يجب تقديم ملاحظة حل غير فارغة بعد إزالة المسافات
  الزائدة، وبحد أقصى 1,000 حرف. تبقى الملاحظة اختيارية في انتقالات الحالات الأخرى.
- `complaints.close` صلاحية **إضافية** مطلوبة فقط عند الإغلاق (`resolved → closed`).
  أي أن الإغلاق يتطلب `complaints.assign` **و** `complaints.close` معاً.
- الرفض (`new → rejected` و`in_review → rejected`) يبقى ضمن `complaints.assign`
  وحده دون أي تغيير.
- `GET /:id/transitions` يعرض انتقالات سير العمل الحالية، لكن الخدمة تحذف انتقال
  `closed` عندما لا يملك المنفِّذ `complaints.close`. إخفاء الإجراء في الواجهة
  إجراء تكميلي، بينما يبقى التحقق من الصلاحية في الخادم هو المرجع الملزم.
