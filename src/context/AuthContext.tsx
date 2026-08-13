import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';
import type { UserSummary } from '../api/types';

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pl_token');
    const cached = localStorage.getItem('pl_user');
    if (token && cached) {
      setUser(JSON.parse(cached));
      // Validate token is still good / refresh cached profile
      api.me().then(setUser).catch(() => {
        localStorage.removeItem('pl_token');
        localStorage.removeItem('pl_user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    const { token, user: loggedInUser } = await api.login(username, password);
    localStorage.setItem('pl_token', token);
    localStorage.setItem('pl_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }

  function logout() {
    localStorage.removeItem('pl_token');
    localStorage.removeItem('pl_user');
    setUser(null);
  }

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
