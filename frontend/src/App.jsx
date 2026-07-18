import ComplaintPage from './pages/ComplaintPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__badge">CF</div>
        <div className="app-header__titles">
          <h1>نظام إدارة الشكاوى والمقترحات</h1>
          <p>Complaints &amp; Feedback Management System</p>
        </div>
      </header>

      <main className="app-main">
        <ComplaintPage />
      </main>

      <footer className="app-footer">© {new Date().getFullYear()} CFMS — جميع الحقوق محفوظة</footer>
    </div>
  );
}
