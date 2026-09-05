import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
          padding: '20px',
          direction: 'rtl'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><TriangleAlert size={44} aria-hidden="true" color="var(--color-warning)" /></div>
            <h1 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', color: 'var(--color-danger)' }}>عذراً، حدث خطأ غير متوقع</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              نأسف لذلك. يرجى تحديث الصفحة أو المحاولة مرة أخرى لاحقاً.
            </p>
            {this.state.error && (
              <pre style={{ 
                background: '#f1f5f9', 
                padding: '12px', 
                borderRadius: '6px', 
                textAlign: 'left', 
                direction: 'ltr',
                fontSize: '12px',
                overflowX: 'auto',
                marginBottom: '24px',
                color: '#475569'
              }}>
                {this.state.error.message}
              </pre>
            )}
            <button 
              className="btn btn-primary" 
              onClick={() => window.location.reload()}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
