import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type AuthUser, type MembershipOrganization } from '../api/authApi';
import { ORGANIZATION_STORAGE_KEY } from '../api/axiosClient';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Active memberships confirmed by /auth/me — the only switchable organizations. */
  organizations: MembershipOrganization[];
  currentOrganization: MembershipOrganization | null;
  currentOrganizationId: number | null;
  isSwitching: boolean;
  /** Switch the active tenant context (session-scoped, membership-validated). */
  switchOrganization: (organizationId: number) => void;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  hasPermission: (permissionCode: string, organizationId?: number, orgUnitId?: number | null) => boolean;
  /**
   * Re-fetches /auth/me and re-resolves the active organization through the
   * existing precedence (stored selection → default → first membership).
   * Used after membership-affecting changes made by the logged-in user
   * (e.g. a primary-membership change) so the switcher stays correct.
   */
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolves the active organization id for the session:
 * 1. the session-stored selection — but ONLY if /auth/me still confirms it,
 * 2. otherwise the user's default organization — but ONLY if still confirmed,
 * 3. otherwise the first active membership (primary first).
 * An unauthorized stored id silently falls back — it can never grant access
 * to an organization the backend has not confirmed.
 */
const resolveCurrentOrganizationId = (
  user: AuthUser | null,
  organizations: MembershipOrganization[]
): number | null => {
  if (organizations.length === 0) {
    return user?.defaultOrganizationId ?? null;
  }
  const storedId = Number(sessionStorage.getItem(ORGANIZATION_STORAGE_KEY));
  if (Number.isSafeInteger(storedId) && organizations.some((org) => org.id === storedId)) {
    return storedId;
  }
  sessionStorage.removeItem(ORGANIZATION_STORAGE_KEY);
  const defaultId = user?.defaultOrganizationId;
  if (defaultId !== null && defaultId !== undefined && organizations.some((org) => org.id === defaultId)) {
    return defaultId;
  }
  const fallback = organizations[0];
  return fallback ? fallback.id : null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cfms_token'));
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<MembershipOrganization[]>([]);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<number | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

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
            const memberships = userData.organizations ?? [];
            setOrganizations(memberships);
            setCurrentOrganizationId(resolveCurrentOrganizationId(userData, memberships));
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
    sessionStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setCurrentOrganizationId(null);
  };

  const refreshMe = async () => {
    try {
      const userData = await getMe();
      setUser(userData);
      const memberships = userData.organizations ?? [];
      setOrganizations(memberships);
      setCurrentOrganizationId(resolveCurrentOrganizationId(userData, memberships));
    } catch {
      // Session no longer valid — let the existing unauthorized handler/flow run.
      logout();
    }
  };

  const switchOrganization = (organizationId: number) => {
    if (isSwitching) return;
    // Only memberships confirmed by /auth/me are switchable; the backend
    // re-validates the header on every request regardless.
    if (!organizations.some((org) => org.id === organizationId)) return;
    if (organizationId === currentOrganizationId) return;
    sessionStorage.setItem(ORGANIZATION_STORAGE_KEY, String(organizationId));
    setCurrentOrganizationId(organizationId);
    setIsSwitching(true);
    // Brief guard window prevents double-fire while pages remount and refetch.
    window.setTimeout(() => setIsSwitching(false), 400);
  };

  const hasPermission = (permissionCode: string, organizationId?: number, orgUnitId?: number | null): boolean => {
    if (!user || !user.permissions) return false;
    const effectiveOrgId = organizationId ?? currentOrganizationId;
    if (effectiveOrgId === null || effectiveOrgId === undefined) return false;
    return user.permissions.some(
      (p) =>
        p.code === permissionCode &&
        p.organizationId === effectiveOrgId &&
        (orgUnitId === undefined || orgUnitId === null || p.orgUnitId === null || p.orgUnitId === orgUnitId)
    );
  };

  const currentOrganization = organizations.find((org) => org.id === currentOrganizationId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        organizations,
        currentOrganization,
        currentOrganizationId,
        isSwitching,
        switchOrganization,
        login,
        logout,
        hasPermission,
        refreshMe,
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
