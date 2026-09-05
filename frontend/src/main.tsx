import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './styles/admin-foundation.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/shell.css';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/admin/ui/Toast';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
