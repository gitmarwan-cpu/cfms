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
| 2.2 Workflow Integration (Lifecycle/Timeline قابل للتخصيص) | ⏳ يعتمد على Workflow Engine (Phase 1.5) |
| 2.3 Assignment بأقسام/فرق/تصعيد | ⏳ يوجد إسناد لموظف فردي فقط (`assignedToUserId`) |
| 2.4 Dashboard | ⏳ غير مبني |
| 2.5 Public Tracking | ✅ منجز |
