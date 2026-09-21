import { Routes, Route, Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import ComplaintPage from './pages/ComplaintPage';
import TrackComplaintPage from './pages/TrackComplaintPage';
import { OrganizationProvider, useOrganization } from './context/OrganizationContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AppShell from './components/shell/AppShell';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import ComplaintListPage from './pages/admin/ComplaintListPage';
import ComplaintDetailPage from './pages/admin/ComplaintDetailPage';
import RolesPage from './pages/admin/RolesPage';
import UsersPage from './pages/admin/UsersPage';
import OrganizationPage from './pages/admin/OrganizationPage';
import OrgStructurePage from './pages/admin/OrgStructurePage';
import ReferenceDataPage from './pages/admin/ReferenceDataPage';
import SlaPage from './pages/admin/SlaPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import PlatformUsersPage from './pages/admin/PlatformUsersPage';
import PlatformUserDetailPage from './pages/admin/PlatformUserDetailPage';
import PlatformTenantsPage from './pages/admin/PlatformTenantsPage';
import PlatformTenantDetailPage from './pages/admin/PlatformTenantDetailPage';
import TenantProvisioningPage from './pages/admin/TenantProvisioningPage';
import PlatformMembershipsRolesPage from './pages/admin/PlatformMembershipsRolesPage';
import PermissionGate, { AdminRoleGate, PlatformPermissionGate } from './components/admin/PermissionGate';

function PlatformPlaceholder({ title }: { title: string }) {
  return (
    <section className="admin-state">
      <h1>{title}</h1>
      <p>هذه مساحة إدارة المنصة. سيتم تفعيل الوظيفة في مرحلة لاحقة.</p>
    </section>
  );
}

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
      <div className="public-portal">
        <AppHeader />
        <main className="app-main">{children}</main>
        <AppFooter />
      </div>
    </OrganizationProvider>
  );
}

function NoOrganizationSelected() {
  return (
    <div className="public-portal">
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
        <Route element={<AppShell />}>
          <Route index element={<PermissionGate permission="complaints.view_all"><DashboardPage /></PermissionGate>} />
          <Route path="complaints" element={<PermissionGate permission="complaints.view_all"><ComplaintListPage /></PermissionGate>} />
          <Route path="complaints/:id" element={<PermissionGate permission="complaints.view_all"><ComplaintDetailPage /></PermissionGate>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="organization" element={<PermissionGate permission="organization.view"><OrganizationPage /></PermissionGate>} />
          <Route path="roles" element={<PermissionGate permission="roles.view"><RolesPage /></PermissionGate>} />
          <Route path="users" element={<PermissionGate permission="users.view"><UsersPage /></PermissionGate>} />
          <Route path="org-structure" element={<PermissionGate permission="org_structure.view"><OrgStructurePage /></PermissionGate>} />
          <Route path="reference-data" element={<PermissionGate permission="reference_data.view"><ReferenceDataPage /></PermissionGate>} />
          <Route path="sla" element={<PermissionGate permission="organization.view"><SlaPage /></PermissionGate>} />
          <Route path="audit" element={<AdminRoleGate><AuditLogPage /></AdminRoleGate>} />
          <Route
            path="platform"
            element={
              <PlatformPermissionGate
                anyPermission={[
                  'platform.users.manage',
                  'platform.tenant.create',
                  'platform.tenant.lifecycle',
                  'platform.memberships.manage',
                ]}
              >
                <PlatformPlaceholder title="إدارة المنصة" />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/users"
            element={
              <PlatformPermissionGate permission="platform.users.manage">
                <PlatformUsersPage />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/users/:userId"
            element={
              <PlatformPermissionGate permission="platform.users.manage">
                <PlatformUserDetailPage />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/tenants/new"
            element={
              <PlatformPermissionGate permission="platform.tenant.create">
                <TenantProvisioningPage />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/tenants"
            element={
              <PlatformPermissionGate permission="platform.tenant.lifecycle">
                <PlatformTenantsPage />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/tenants/:organizationId"
            element={
              <PlatformPermissionGate permission="platform.tenant.lifecycle">
                <PlatformTenantDetailPage />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/tenants/lifecycle"
            element={
              <PlatformPermissionGate permission="platform.tenant.lifecycle">
                <PlatformPlaceholder title="دورة حياة المستأجرين" />
              </PlatformPermissionGate>
            }
          />
          <Route
            path="platform/memberships-roles"
            element={
              <PlatformPermissionGate permission="platform.memberships.manage">
                <PlatformMembershipsRolesPage />
              </PlatformPermissionGate>
            }
          />
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
