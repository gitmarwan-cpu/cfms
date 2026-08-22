# CFMS Frontend — Architecture & Engineering Standards

**الحالة: المرجع الرسمي الوحيد لتقنية ومعايير تطوير الواجهة الأمامية.**

هذا الملف يحدد الـ frontend stack، المعمارية، معايير التطوير، وقواعد الترحيل التدريجي.
لا يصف التاريخ السابق للمشروع أو القرارات الملغاة.

---

## 1. Approved Stack

### Core

* React 18
* TypeScript
* Vite
* React Router
* Tailwind CSS
* shadcn/ui
* Radix UI
* Lucide React

### Application State

الحالة المحلية تُدار باستخدام:

* `useState`
* `useReducer` عند الحاجة
* React Context للحالة المشتركة محدودة النطاق

السياقات الحالية تشمل:

* `AuthContext`
* `OrganizationContext`

لا يتم إدخال Zustand أو مكتبة state management أخرى دون حاجة معمارية واضحة.

### Server State

لا تُنشأ طبقة Server State مستقلة لمجرد وجود API.

عند ظهور حاجة فعلية تشمل:

* caching
* request deduplication
* background refetching
* synchronization
* complex server-state lifecycles

يمكن تقييم TanStack Query.

ليس مطلوبًا إدخاله مسبقًا.

---

## 2. Frontend Architecture

يجب أن تبقى الواجهة منظمة حول مسؤوليات واضحة:

```text
Pages
  ↓
Feature Components
  ↓
Shared UI Components
  ↓
Hooks / Context
  ↓
API Layer
  ↓
Backend API
```

### Pages

مسؤولة عن تركيب الصفحة وربط الميزات ببعضها.

لا تحتوي على business logic معقد أو استدعاءات API متكررة يمكن إعادة استخدامها.

### Feature Components

تمثل وظائف النظام مثل:

* Complaint management
* Dashboard
* User management
* Organization management
* Reference data
* Reports

### Shared Components

المكونات القابلة لإعادة الاستخدام يجب أن تكون في طبقة مشتركة، مثل:

* Button
* Input
* Select
* Dialog
* Sheet
* Table
* Tabs
* Badge
* Alert
* Skeleton
* Empty state
* Data state

استخدم shadcn/ui عندما يكون المكوّن مناسبًا بدل إنشاء بديل يدوي.

---

## 3. UI Component Standards

### Design System

المكونات الجديدة تستخدم:

* Tailwind CSS
* shadcn/ui
* Radix UI primitives عند الحاجة
* Lucide React للأيقونات

لا يتم إنشاء نظام UI ثانٍ داخل المشروع.

لا تستخدم Bootstrap أو مكتبات UI متعارضة مع النظام المعتمد.

### Icons

استخدم `lucide-react`.

لا تستخدم:

* Emoji كأيقونات واجهة.
* صورًا كبديل لأيقونات UI.
* عدة مكتبات أيقونات لنفس الغرض.

---

## 4. Styling

Tailwind CSS هو الأسلوب الأساسي للمكونات الجديدة.

تجنب:

```tsx
style={{ ... }}
```

عندما يمكن تمثيل التصميم بشكل واضح باستخدام Tailwind.

استخدم CSS مخصصًا فقط عندما تكون هناك حاجة حقيقية لا يوفرها Tailwind بشكل مناسب.

يجب الحفاظ على Design Tokens المشتركة وعدم إنشاء ألوان أو أحجام أو radii عشوائية داخل المكونات.

---

## 5. Responsive Design

الواجهة يجب أن تكون Responsive by Default.

يجب أن تعمل الواجهات على:

* Desktop
* Laptop
* Tablet
* Mobile

لا تعتمد على أحجام ثابتة أو تخطيطات تفترض شاشة Desktop فقط.

يفضل استخدام:

```text
mobile-first
grid/flex
responsive breakpoints
CSS logical properties
```

مثل:

```text
ms-* / me-*
ps-* / pe-*
```

بدل الاعتماد غير الضروري على:

```text
ml-* / mr-*
pl-* / pr-*
```

عند تصميم واجهات قد تدعم RTL وLTR مستقبلًا.

---

## 6. RTL and Localization

الواجهة الحالية عربية وRTL.

يجب أن تكون المكونات الجديدة متوافقة مع RTL من البداية.

لا تستخدم حلولًا تعتمد على اتجاه ثابت عندما يمكن استخدام CSS logical properties.

لا hard-code النصوص داخل مكونات عامة إذا كان المكوّن قابلًا لإعادة الاستخدام.

إضافة نظام i18n مستقل ليست مطلوبة حاليًا، لكن المكونات يجب ألا تُصمم بطريقة تمنع إضافته مستقبلًا.

---

## 7. Accessibility

الوصولية جزء من Definition of Done.

يجب دعم:

* Keyboard navigation
* Visible focus states
* Semantic HTML
* Proper labels
* Accessible form errors
* Dialog focus management
* ARIA attributes عند الحاجة
* Sufficient contrast
* Screen-reader-friendly states

استخدم Radix/shadcn/ui للمكونات التفاعلية المعقدة بدل إعادة تنفيذ سلوك accessibility يدويًا.

---

## 8. Application States

كل صفحة أو مكون يتعامل مع بيانات خارجية يجب أن يعالج الحالات الأساسية:

```text
Loading
Success
Empty
Error
```

استخدم:

* `Skeleton` للحالات المناسبة للتحميل.
* Empty states عندما لا توجد بيانات.
* Alert أو feedback مناسب للأخطاء.
* Disabled/loading states أثناء العمليات.

لا تترك واجهة فارغة أو غير واضحة أثناء انتظار API.

---

## 9. Forms

النماذج يجب أن تكون:

* واضحة بصريًا
* Responsive
* قابلة للوصول
* مرتبطة برسائل validation واضحة
* متوافقة مع API validation

استخدم Zod لمشاركة أو توحيد قواعد التحقق حيث يكون ذلك مناسبًا.

لا تعتمد على frontend validation كبديل عن backend validation.

الـ backend يبقى المصدر النهائي للتحقق.

---

## 10. API Integration

كل API access يجب أن يمر عبر طبقة API مخصصة.

مثال:

```text
frontend/src/api/
```

لا تضع Axios/fetch calls مباشرة داخل مكونات UI إلا إذا كان ذلك مبررًا لحالة بسيطة جدًا.

طبقة API مسؤولة عن:

* HTTP requests
* authentication headers
* response handling
* API errors
* serialization/deserialization

المكونات تتعامل مع بيانات التطبيق، وليس تفاصيل HTTP.

---

## 11. Organizational Context & Authorization

الـ frontend قد يعرض organizational context للمستخدم، لكنه **ليس مصدرًا للصلاحيات**.

لا تعتمد الواجهة على:

```text
organizationId من المستخدم
role من الواجهة
permission من localStorage
```

لتحديد ما إذا كانت العملية مسموحة أمنيًا.

الـ backend هو المسؤول عن:

* Authentication
* Organization membership
* Organizational scope
* Permissions
* Resource authorization

يمكن للواجهة إخفاء أو تعطيل عناصر UI بناءً على حالة المستخدم لتحسين UX، لكن ذلك ليس Security Boundary.

---

## 12. Tables, Filters and Pagination

الجداول الإدارية يجب أن تدعم عند الحاجة:

* Pagination
* Sorting
* Filtering
* Search
* Loading state
* Empty state
* Error state
* Responsive behavior

يجب أن تتطابق الفلاتر مع API contract.

لا ترسل قيمًا غير موثوقة أو filters غير معروفة إلى backend.

في الشاشات الصغيرة يجب توفير تجربة مناسبة بدل إجبار المستخدم على جدول Desktop عريض.

---

## 13. Dashboards & Data Visualization

لوحات المعلومات يجب أن تكون:

* واضحة بصريًا
* responsive
* قابلة للقراءة على الشاشات الصغيرة
* مبنية على بيانات API حقيقية
* متسقة في الألوان والتسميات
* قابلة للتحكم عندما تكون كثافة المعلومات عالية

يجب أن تتضمن الرسوم والـ KPI cards حالات:

```text
Loading
No data
Error
Data
```

لا تعرض أرقامًا أو مؤشرات وهمية عند فشل تحميل البيانات.

---

## 14. Performance

الأداء مهم، لكن لا تضف abstraction أو dependency لمجرد تحسين نظري.

استخدم عند الحاجة:

* Route-level lazy loading
* Component lazy loading
* Memoization عندما يكون لها أثر فعلي
* Stable callbacks عندما تكون ضرورية
* Pagination للبيانات الكبيرة
* تجنب rendering غير الضروري
* تجنب تحميل بيانات غير مطلوبة

لا تستخدم `useMemo` أو `useCallback` بشكل عشوائي.

---

## 15. TypeScript Standards

جميع ملفات الإنتاج الجديدة داخل:

```text
frontend/src
```

يجب أن تكون TypeScript:

```text
.ts
.tsx
```

لا تتم إضافة JavaScript/JSX جديد إلى production code.

يجب تعريف الأنواع بوضوح لبيانات:

* API responses
* Forms
* Props
* Contexts
* Tables
* Filters
* Pagination

تجنب:

```ts
any
```

إلا عند وجود سبب تقني واضح ومحدد.

---

## 16. Routing

React Router هو نظام التوجيه المعتمد.

يجب فصل:

* Public routes
* Authenticated routes
* Administrative routes

Route protection في frontend هدفه UX والتنقل الصحيح، وليس بديلًا عن authorization في backend.

---

## 17. Migration Strategy

الترحيل إلى النظام الحديث **تدريجي**.

### New Development

أي صفحة أو مكون جديد:

* TypeScript
* Tailwind CSS
* shadcn/ui
* Radix عند الحاجة
* Lucide React

### Existing Pages

لا تتم إعادة كتابة الصفحات القديمة بالكامل لمجرد تغيير التصميم.

عند تعديل صفحة موجودة لإضافة ميزة حقيقية:

> **Boy Scout Rule**

أعد بناء الجزء الذي تعمل عليه باستخدام النظام الحديث، دون إعادة كتابة بقية الصفحة بلا داعٍ.

### Legacy CSS

يمكن أن يتعايش CSS الحالي مؤقتًا مع Tailwind أثناء الترحيل.

لا تتم إزالة CSS القديم إلا عندما تصبح الأجزاء التي تعتمد عليه غير مستخدمة أو يتم ترحيلها بشكل آمن.

---

## 18. Shared UI Migration

المكونات المشتركة ذات الاستخدام الواسع لها أولوية أعلى في الترحيل لأنها تؤثر على عدة صفحات.

يتم تقييم مكونات مثل:

```text
AdminUi.tsx
Dialog
FormDialog
ConfirmDialog
LoadingSkeleton
DataState
```

وترحيلها تدريجيًا إلى primitives ومكونات shadcn/ui المناسبة.

لا يتم تغيير public behavior للمكونات دون التحقق من الصفحات التي تعتمد عليها.

---

## 19. Existing Pages

الصفحات الإدارية الموجودة لا تُعاد كتابتها دفعة واحدة.

القاعدة:

```text
New → Modern Stack
Changed → Modernize touched area
Stable → Leave until needed
```

الهدف هو تقليل المخاطر والحفاظ على استقرار النظام أثناء التطوير.

---

## 20. Definition of Done

أي frontend feature جديدة تعتبر مكتملة عندما:

* تستخدم TypeScript.
* تتبع الـ component architecture.
* تستخدم الـ design system المعتمد.
* تعمل على الشاشات المختلفة.
* تدعم RTL.
* تحتوي loading/empty/error states عند الحاجة.
* تراعي accessibility.
* تستخدم API layer المناسبة.
* لا تتجاوز backend authorization.
* لا تضيف dependency غير ضرورية.
* لا تكسر الصفحات أو المكونات الحالية.
* تمر باختبارات/build المناسبة.

---

## 21. Core Principles

> **TypeScript for safety.**
> **Tailwind for styling.**
> **shadcn/ui + Radix for accessible UI primitives.**
> **React Context for limited shared client state.**
> **API layer for backend communication.**
> **Responsive and RTL by default.**
> **Loading, empty and error states are part of the UI.**
> **The backend is the security boundary.**
> **Modernize incrementally; do not rewrite unnecessarily.**
