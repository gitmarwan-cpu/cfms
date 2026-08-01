# Module: Reference Data

جزء من **Core Platform**. التفاصيل التقنية الكاملة في
[`../../docs/REFERENCE_DATA.md`](../../docs/REFERENCE_DATA.md).

## الغرض

آلية عامة واحدة لأي قائمة قيم قابلة للتخصيص عبر المؤسسات (تصنيفات، قنوات،
حالات، أولويات...) بنمط Template+Override، بدلاً من جداول/ENUM منفصلة لكل نوع.
تُستخدَم اليوم من وحدة الشكاوى، وستُستخدَم من أي وحدة أعمال مستقبلية بلا أي
تعديل على البنية نفسها.

## القوائم الموجودة حالياً

`gender`, `age_group`, `complaint_category`, `channel`, `complaint_type`,
`priority`, `complainant_relationship` — التفاصيل الكاملة (نظامية/قابلة
للتخصيص، القيم الافتراضية) في [`../../docs/REFERENCE_DATA.md`](../../docs/REFERENCE_DATA.md).

## قبل إضافة قائمة جديدة

اقرأ قسم "⚠️ فخ حقيقي وقعنا فيه مرتين" في
[`../../docs/REFERENCE_DATA.md`](../../docs/REFERENCE_DATA.md) — خطأ تكرار
حقيقي وقع مرتين بسبب عدم فهم سلوك `sequelize-cli` مع الـ seeders.
