# SmartCFMS Frontend Design Specification

Version: 1.0
Status: Draft for architecture approval
Date: 2026-07-21

## 1. Purpose

This specification defines the frontend architecture, interaction model, visual system, development standards, and implementation strategy for SmartCFMS. It is intended to guide the first production-ready frontend build while remaining aligned with the current React + Vite foundation already present in the repository.

The design is centered on a secure, accessible, multilingual, and mobile-first complaints and feedback management experience for Yemen-based public service operations.

---

## 2. Frontend Architecture

### 2.1 Core Principles

- Build a scalable single-page application with clear domain separation.
- Keep the experience simple for first-time users while supporting future admin and dashboard modules.
- Prioritize accessibility, Arabic-first UX, and low-friction forms.
- Ensure the architecture can support future growth into dashboards, case management, analytics, and role-based administration.

### 2.2 Recommended Stack

- React 18 for UI composition
- Vite for development and build tooling
- React Router for routing
- Axios for API communication
- React Query / TanStack Query for server-state caching and synchronization
- Context API for global UI concerns such as auth, theme, and locale
- CSS variables for design tokens and themeing
- ESLint + Prettier for code quality

### 2.3 Architectural Approach

The frontend should follow a layered architecture:

1. App shell and providers
2. Route-based feature modules
3. Shared UI primitives and design system
4. API and data services
5. Shared utilities, hooks, and validation logic

This keeps business features isolated while allowing shared behavior to be reused consistently.

### 2.4 High-Level Structure

- Public entry experience for complaint submission and status tracking
- Authenticated experience for staff or administrators
- Shared infrastructure for notifications, forms, file uploads, and localization

---

## 3. Folder Structure

The proposed frontend structure is:

```text
frontend/
  public/
    icons/
    images/
    locales/
  src/
    app/
      App.jsx
      providers/
        AuthProvider.jsx
        ThemeProvider.jsx
        LocaleProvider.jsx
      routes/
        AppRoutes.jsx
        ProtectedRoute.jsx
        PublicRoute.jsx
    features/
      auth/
        components/
        pages/
        hooks/
        services/
        validations/
      complaints/
        components/
        pages/
        hooks/
        services/
        validations/
      dashboard/
        components/
        pages/
      admin/
        components/
        pages/
      settings/
        components/
        pages/
    shared/
      components/
        ui/
        forms/
        layout/
      hooks/
      utils/
      services/
      constants/
      types/
      styles/
    config/
      api.js
      routes.js
      branding.js
    locales/
      en.json
      ar.json
    assets/
      fonts/
      images/
      icons/
    main.jsx
    index.css
```

### 3.1 Folder Conventions

- Feature-based folders should own their components, hooks, services, and validations.
- Shared modules stay generic and reusable.
- All route-level pages should be thin wrappers around feature components.
- Business logic should be extracted into services or hooks rather than embedded directly in pages.

---

## 4. Design System

### 4.1 Visual Direction

The UI should feel trustworthy, modern, and government-friendly. It should be calm, structured, and optimized for form-heavy tasks.

### 4.2 Core Design Principles

- Clarity over decoration
- Consistency across components and flows
- Strong contrast and readable typography
- Mobile-first interactions
- Clear progress and feedback for every step

### 4.3 Layout Scale

- Spacing scale: 4, 8, 12, 16, 24, 32, 40, 48, 64
- Grid: 12-column layout on large screens, 8-column on tablets, 4-column on mobile
- Content width: max 1200px with centered layout

### 4.4 Typography

- Primary Arabic-friendly font stack: Noto Naskh Arabic, Tajawal, or similar modern Arabic-readable font
- English fallback: Inter, system-ui, sans-serif
- Type scale:
  - H1: 32px / 40px
  - H2: 24px / 32px
  - H3: 20px / 28px
  - Body: 16px / 24px
  - Small: 14px / 20px
  - Caption: 12px / 16px

### 4.5 Component Language

- Cards for summaries and content blocks
- Panels for multi-section forms
- Tables for complaint lists and audit views
- Empty states with clear actions for no-data scenarios
- Stepper or progress indicators for multi-step workflows

---

## 5. Dynamic Design Tokens

Design tokens should be defined as CSS custom properties and made available to the whole application.

### 5.1 Token Categories

- Color tokens
- Spacing tokens
- Radius tokens
- Shadow tokens
- Typography tokens
- Motion tokens

### 5.2 Example Token Structure

```css
:root {
  --color-primary: #0f6cbd;
  --color-primary-strong: #0b4f86;
  --color-accent: #19a7a7;
  --color-surface: #ffffff;
  --color-surface-muted: #f7f9fc;
  --color-text: #14213d;
  --color-text-muted: #5f6b7a;
  --color-border: #dce4ee;
  --color-success: #2f855a;
  --color-warning: #c97a00;
  --color-danger: #c53030;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.08);

  --font-family-base: "Noto Naskh Arabic", "Tajawal", sans-serif;
}
```

### 5.3 Token Rules

- Tokens must be referenced by components rather than hardcoded values.
- Tokens should support runtime updates for themes and branding.
- All interactive states should be token-driven: hover, focus, active, disabled.

---

## 6. Theme Management

### 6.1 Requirements

The system should support:

- Light and dark themes
- Organization-specific brand themes
- Locale-aware color contrast and direction adjustments

### 6.2 Implementation Model

- A ThemeProvider should expose the active theme and allow switching.
- CSS custom properties should be updated at runtime based on the selected theme.
- Brand values should be loaded from a centralized config file or server-provided metadata.

### 6.3 Theme Layering

1. Base tokens
2. Brand tokens
3. Semantic tokens
4. Component tokens

This allows branding changes without rewriting component styles.

---

## 7. Organization Branding

SmartCFMS should support configurable organizational identity while remaining consistent with public-sector design expectations.

### 7.1 Branding Inputs

- Organization name
- Short name or acronym
- Logo and favicon
- Primary and secondary colors
- Support contact details
- Legal footer text
- Locale-specific tagline or description

### 7.2 Branding Strategy

The frontend should not hardcode branding language directly inside components. Instead, branding should be driven by a central config object, such as:

```js
export const brandingConfig = {
  name: 'SmartCFMS',
  shortName: 'CFMS',
  primaryColor: '#0f6cbd',
  accentColor: '#19a7a7',
  logoUrl: '/images/logo.svg',
  supportEmail: 'support@cfms.local'
};
```

This allows the UI to adapt to different departments or client organizations without structural changes.

---

## 8. Responsive Strategy

### 8.1 Approach

The UI should follow a mobile-first strategy with progressive enhancement for larger screens.

### 8.2 Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1023px
- Desktop: 1024px and above

### 8.3 Responsive Rules

- Navigation should collapse into a compact mobile menu.
- Forms should stack vertically on small screens.
- Tables should transform into cards or scroll containers on mobile.
- Important actions should remain within thumb reach on mobile devices.

### 8.4 Layout Behavior

- Use flexible containers and responsive spacing.
- Components should support both RTL and LTR without layout breakage.
- Avoid horizontal overflow in forms and lists.

---

## 9. State Management

### 9.1 State Categories

- Local UI state: modal visibility, dropdown open state, form drafts
- Feature state: current complaint submission flow, selected location, wizard step
- Server state: complaints, users, locations, audit records
- Global app state: auth, theme, locale, organization branding

### 9.2 Recommended Model

- Use local component state for simple and isolated UI behavior.
- Use React hooks and feature-level state for moderate complexity.
- Use Context for auth, theme, and locale.
- Use React Query for asynchronous server data and caching.

### 9.3 State Rules

- Avoid prop drilling for shared global concerns.
- Avoid storing large derived data in local component state when it can be cached at the query layer.
- Keep optimistic updates limited to low-risk actions.

---

## 10. API Layer

### 10.1 Goals

The API layer should be centralized, predictable, and resilient.

### 10.2 Structure

- One shared Axios instance for common configuration
- Feature-level service modules for domain requests
- Clear error transformation for UI consumption
- Centralized upload handling for files and attachments

### 10.3 Expected Behaviors

- Attach auth tokens automatically
- Normalize server response shapes
- Intercept unauthorized responses
- Convert API errors into actionable UI messages
- Support multipart uploads and file progress states

### 10.4 Response Handling

All API responses should be normalized into a consistent structure:

```js
{
  data,
  message,
  success,
  errors
}
```

This reduces duplication in components and simplifies future integration.

---

## 11. Authentication Flow

### 11.1 User Roles

- Public user: submits complaints and views own submission status
- Staff user: reviews and manages complaint records
- Administrator: manages configuration, users, and system settings

### 11.2 Flow

1. User enters credentials or submits a public form.
2. Access token is stored securely and attached to API requests.
3. Protected routes check auth state before rendering.
4. Expired or invalid sessions trigger a clear re-authentication flow.
5. Logout clears session state and redirects to the appropriate public or login route.

### 11.3 Security Expectations

- Never expose sensitive tokens in public routes.
- Use route guards for protected areas.
- Support session expiration feedback and safe redirect behavior.
- Prevent direct access to restricted pages via URL manipulation.

---

## 12. Routing Strategy

### 12.1 Routing Model

Use React Router with route-based code splitting.

### 12.2 Route Categories

- Public routes: home, complaint submission, status lookup, help, privacy
- Protected routes: dashboard, case review, reporting, admin tools
- Error routes: not found, unauthorized, server error

### 12.3 Navigation Model

- Route-based layout wrappers should define page shells.
- Shared navigation should adapt for desktop and mobile viewports.
- Route transitions should be smooth but lightweight.

### 12.4 Route Structure Example

```text
/                      -> Home or landing page
/submit                -> Complaint submission form
/status/:reference     -> Submission status page
/login                 -> Staff login
/dashboard             -> Staff dashboard
/complaints/:id        -> Complaint detail page
/admin                 -> Admin landing page
```

---

## 13. Reusable Components

Components should be designed to be composable, accessible, and theme-aware.

### 13.1 Shared UI Components

- Button
- Input
- Select
- Textarea
- Checkbox / Radio
- File upload
- Modal
- Drawer
- Tabs
- Accordion
- Alert
- Badge
- Empty state
- Skeleton loader
- Data table
- Pagination
- Breadcrumbs
- Card
- Section header

### 13.2 Form Components

- Field wrapper
- Error message block
- Form section
- Wizard stepper
- Location selector
- File attachment list
- Consent checkbox group

### 13.3 Layout Components

- App shell
- Header
- Sidebar
- Main content container
- Footer
- Page title area

---

## 14. Form Standards

### 14.1 Form Design Principles

- Forms should be short, clear, and grouped by intent.
- Required fields must be visually obvious.
- Inline help should support, not clutter, the task.
- Important decisions should be explicit and easy to review.

### 14.2 Form Patterns

- Single-page forms for simple submissions
- Multi-step steps for complex workflows
- Progressive disclosure for optional details
- Save draft support for long forms where appropriate

### 14.3 Input Behavior

- Inputs should be controlled components.
- Field values should be preserved across validation failures.
- Focus should move to the first invalid field when a submit fails.
- Error messages should appear close to the relevant field.

---

## 15. Validation Strategy

### 15.1 Validation Layers

- Client-side validation for immediate feedback
- Form schema validation for consistency
- Server-side validation for authoritative enforcement

### 15.2 Recommended Validation Tools

- Zod for schema definition and validation
- React Hook Form for form state and validation orchestration

### 15.3 Validation Rules

- Required fields must be validated before submission.
- Sensitive fields should have explicit validation and handling rules.
- File validation should enforce format, size, and count limits.
- Validation should be localized and user-friendly.

### 15.4 Error Mapping

Server-side validation errors should be mapped to the correct field and displayed near the input.

---

## 16. Error Handling

### 16.1 Error Types

- Network failures
- Validation errors
- Auth/session errors
- Not found and unauthorized states
- Unexpected runtime exceptions

### 16.2 Handling Strategy

- Use a global error boundary for unexpected UI crashes.
- Show inline errors on forms.
- Show toast or banner notifications for non-blocking failures.
- Use dedicated empty and fallback states for missing data.

### 16.3 User-Facing Error Principles

- Errors must be clear and actionable.
- Avoid technical messages where user-friendly language is possible.
- Provide recovery options whenever possible.

---

## 17. Loading States

### 17.1 Loading Principles

All asynchronous actions should provide visible feedback.

### 17.2 Recommended Patterns

- Inline button loading states
- Skeleton screens for page-level content loading
- Spinners for small data refreshes
- Progress indicators for file uploads and multi-step submissions

### 17.3 Content Priority

The UI should preserve layout stability and avoid layout shift where possible.

---

## 18. Accessibility

### 18.1 Accessibility Standard

The frontend should meet WCAG 2.2 AA expectations.

### 18.2 Requirements

- Semantic HTML structure
- Keyboard accessibility for all interactive controls
- Visible focus states
- Sufficient color contrast
- ARIA labels where necessary
- Support for screen readers and assistive technologies
- Logical heading order and landmark regions

### 18.3 Form Accessibility

- Every input should have a visible label.
- Error text should be associated with the relevant control.
- Validation messages should be announced appropriately.
- Submit actions should be clearly identified.

---

## 19. Internationalization (Arabic RTL / English LTR)

### 19.1 Core Goal

The application must support Arabic and English with proper directional layout and localized content.

### 19.2 Locale Strategy

- Use a locale provider and translation resource files.
- Store translations in JSON files for maintainability.
- Structure content by domain and page rather than by component only.

### 19.3 RTL / LTR Requirements

- Support both Arabic RTL and English LTR layouts.
- Use logical CSS properties where possible.
- Ensure icon alignment, form layout, and navigation adapt to direction changes.
- Preserve user selection and support seamless switching between languages.

### 19.4 Locale-Specific Handling

- Date, number, and currency formatting should be locale-aware.
- Right-to-left layout should not break spacing or alignment.
- Content should be reviewed for natural phrasing in both languages.

---

## 20. Performance Optimization

### 20.1 Performance Goals

- Fast initial load
- Responsive interactions
- Smooth route transitions
- Efficient API usage

### 20.2 Recommended Practices

- Use route-based lazy loading for large modules.
- Split heavy features such as dashboards and admin tools into separate bundles.
- Optimize image and asset loading.
- Use memoization only where it improves real performance.
- Avoid unnecessary re-renders through careful component boundaries.
- Prefer lightweight UI libraries or minimal dependencies.

### 20.3 Data Performance

- Cache frequently requested data.
- Avoid reloading the same resource repeatedly.
- Use pagination and lazy loading for large lists.

---

## 21. Coding Standards

### 21.1 General Standards

- Write clear, readable, and maintainable code.
- Keep components focused and reusable.
- Prefer small functions and composable hooks.
- Avoid large monolithic components.

### 21.2 Naming Conventions

- Components: PascalCase
- Hooks: useXxx
- Services: camelCase with domain-specific names
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for general files, PascalCase for React components

### 21.3 Style Rules

- Use consistent formatting and indentation.
- Use semantic names for props and state variables.
- Keep styling token-driven rather than hardcoded.
- Avoid inline style overrides unless necessary.

### 21.4 Quality Gates

- Linting must be enforced in CI and local development.
- Build validation must be required before merge.
- Core user journeys should have test coverage for submission, validation, routing, and auth flows.

---

## 22. Implementation Phasing

### Phase 1 - Foundation

- App shell
- Theme and branding system
- Locale and routing structure
- Shared UI primitives

### Phase 2 - Core Complaint Experience

- Complaint submission flow
- Location selection
- Validation and error states
- File upload handling

### Phase 3 - Extended Experience

- Status lookup
- Staff dashboard
- Complaint detail views
- Admin and reporting modules

### Phase 4 - Hardening

- Accessibility audits
- Performance profiling
- Security review
- Localization refinement

---

## 23. Approval Criteria

The implementation should be considered ready when:

- The architecture supports public and authenticated user journeys.
- The design system is consistent across forms, pages, and error states.
- Arabic and English experiences are both fully functional.
- Accessibility and responsive behavior are validated.
- The codebase remains maintainable and extensible for future modules.
