import { Routes, Route, Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import ComplaintPage from './pages/ComplaintPage';
import TrackComplaintPage from './pages/TrackComplaintPage';
import { OrganizationProvider, useOrganization } from './context/OrganizationContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import ComplaintListPage from './pages/admin/ComplaintListPage';
import ComplaintDetailPage from './pages/admin/ComplaintDetailPage';

function AppHeader() {
  const { organization, orgSlug } = useOrganization() || {};

  // fallback ثابت فقط في حال تعذّر الوصول للخادم بعد؛ القيم الفعلية تأتي من
  // إعدادات المؤسسة في قاعدة البيانات (organizationApi) بمجرد توفرها.
  const legalName = organization?.legalName || 'نظام إدارة الشكاوى والمقترحات';
  const shortName = organization?.shortName || 'CFMS';
  const logoUrl = organization?.logoUrl;

  return (
    <header className="app-header">
      {logoUrl ? (
        <img src={logoUrl} alt={shortName} className="app-header__logo" />
      ) : (
        <div className="app-header__badge">{shortName.slice(0, 2).toUpperCase()}</div>
      )}
      <div className="app-header__titles">
        <h1>{legalName}</h1>
        <p>{shortName}</p>
      </div>
      <nav className="app-header__nav">
        <Link to={`/${orgSlug}`}>تقديم طلب</Link>
        <Link to={`/${orgSlug}/track`}>متابعة طلب</Link>
      </nav>
    </header>
  );
}

function AppFooter() {
  const { organization } = useOrganization() || {};
  const shortName = organization?.shortName || 'CFMS';
  return (
    <footer className="app-footer">
      © {new Date().getFullYear()} {shortName} — جميع الحقوق محفوظة
    </footer>
  );
}

/**
 * تخطيط بوابة مؤسسة محددة: orgSlug يأتي حصراً من الرابط (Route param)،
 * ولا يوجد أي مسار بديل يفترض مؤسسة معيّنة بشكل ثابت في الكود.
 */
function OrganizationPortalLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      <div className="app-shell">
        <AppHeader />
        <main className="app-main">{children}</main>
        <AppFooter />
      </div>
    </OrganizationProvider>
  );
}

function NoOrganizationSelected() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <div className="card">
          <div className="card__body">
            <h2>لم يتم تحديد مؤسسة</h2>
            <p>
              هذا الرابط يجب أن يتضمن معرّف المؤسسة (orgSlug)، مثال:
              <br />
              <code>https://example.com/save-the-children-ye</code>
            </p>
            <p>الرجاء استخدام الرابط الذي زوّدتك به المؤسسة لتقديم الشكاوى.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NoOrganizationSelected />} />
      <Route
        path="/admin/login"
        element={
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        }
      />
      <Route
        path="/admin"
        element={
          <AuthProvider>
            <ProtectedRoute />
          </AuthProvider>
        }
      >
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="complaints" element={<ComplaintListPage />} />
          <Route path="complaints/:id" element={<ComplaintDetailPage />} />
        </Route>
      </Route>
      <Route
        path="/:orgSlug"
        element={
          <OrganizationPortalLayout>
            <ComplaintPage />
          </OrganizationPortalLayout>
        }
      />
      <Route
        path="/:orgSlug/track"
        element={
          <OrganizationPortalLayout>
            <TrackComplaintPage />
          </OrganizationPortalLayout>
        }
      />
      <Route path="*" element={<NoOrganizationSelected />} />
    </Routes>
  );
}
