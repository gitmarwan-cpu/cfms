import ComplaintPage from './pages/ComplaintPage';
import { OrganizationProvider, useOrganization } from './context/OrganizationContext';

function AppHeader() {
  const { organization } = useOrganization() || {};

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
    </header>
  );
}

function AppFooter() {
  const { organization } = useOrganization() || {};
  const shortName = organization?.shortName || 'CFMS';
  return <footer className="app-footer">© {new Date().getFullYear()} {shortName} — جميع الحقوق محفوظة</footer>;
}

export default function App() {
  return (
    <OrganizationProvider>
      <div className="app-shell">
        <AppHeader />
        <main className="app-main">
          <ComplaintPage />
        </main>
        <AppFooter />
      </div>
    </OrganizationProvider>
  );
}
