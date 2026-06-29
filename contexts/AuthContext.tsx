import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';
import { registerForPushNotificationsAsync } from '@/lib/notifications';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  timezone: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string, timezone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; timezone?: string; username?: string }) => Promise<void>;
  pendingRequestCount: number;
  refreshPendingCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const registerPushToken = useCallback(async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await apiRequest('POST', '/api/push-token', { token }).catch(() => {});
      }
    } catch {}
  }, []);

  const deregisterPushToken = useCallback(async () => {
    try {
      await apiRequest('DELETE', '/api/push-token').catch(() => {});
    } catch {}
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const [connRes, groupRes] = await Promise.all([
        fetch(new URL('/api/connections/pending-count', baseUrl).toString(), { credentials: 'include' }),
        fetch(new URL('/api/groups/pending-count', baseUrl).toString(), { credentials: 'include' }),
      ]);
      let total = 0;
      if (connRes.ok) { const d = await connRes.json(); total += (d.count || 0); }
      if (groupRes.ok) { const d = await groupRes.json(); total += (d.count || 0); }
      setPendingRequestCount(total);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      setPendingRequestCount(0);
      return;
    }
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15000);
    return () => clearInterval(interval);
  }, [user, refreshPendingCount]);

  const checkAuth = async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/auth/me', baseUrl);
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        registerPushToken();
      }
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/login', { username, password });
    const data = await res.json();
    setUser(data);
    registerPushToken();
  }, [registerPushToken]);

  const register = useCallback(async (username: string, password: string, displayName: string, timezone?: string) => {
    const res = await apiRequest('POST', '/api/auth/register', { username, password, displayName, timezone });
    const data = await res.json();
    setUser(data);
    registerPushToken();
  }, [registerPushToken]);

  const logout = useCallback(async () => {
    await deregisterPushToken();
    await apiRequest('POST', '/api/auth/logout');
    setUser(null);
  }, [deregisterPushToken]);

  const updateProfile = useCallback(async (data: { displayName?: string; timezone?: string; username?: string }) => {
    const res = await apiRequest('PUT', '/api/auth/profile', data);
    const updated = await res.json();
    setUser(updated);
  }, []);

  const value = useMemo(() => ({
    user, isLoading, login, register, logout, updateProfile,
    pendingRequestCount, refreshPendingCount,
  }), [user, isLoading, login, register, logout, updateProfile, pendingRequestCount, refreshPendingCount]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
