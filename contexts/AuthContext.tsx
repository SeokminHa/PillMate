import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

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
  updateProfile: (data: { displayName?: string; timezone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL('/api/auth/me', baseUrl);
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
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
  }, []);

  const register = useCallback(async (username: string, password: string, displayName: string, timezone?: string) => {
    const res = await apiRequest('POST', '/api/auth/register', { username, password, displayName, timezone });
    const data = await res.json();
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('POST', '/api/auth/logout');
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { displayName?: string; timezone?: string }) => {
    const res = await apiRequest('PUT', '/api/auth/profile', data);
    const updated = await res.json();
    setUser(updated);
  }, []);

  const value = useMemo(() => ({
    user, isLoading, login, register, logout, updateProfile,
  }), [user, isLoading, login, register, logout, updateProfile]);

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
