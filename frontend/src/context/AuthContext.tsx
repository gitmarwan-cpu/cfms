import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type AuthUser } from '../api/authApi';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permissionCode: string, organizationId: number, orgUnitId?: number | null) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cfms_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('cfms_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('cfms_unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (token) {
      getMe()
        .then((userData) => {
          if (isMounted) {
            setUser(userData);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            logout();
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('cfms_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('cfms_token');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (permissionCode: string, organizationId: number) => {
    if (!user || !user.permissions) return false;
    return user.permissions.some(
      (p) => p.code === permissionCode && p.organizationId === organizationId
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
