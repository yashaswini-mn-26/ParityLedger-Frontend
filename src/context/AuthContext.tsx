
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

import { api } from '../api/client';
import type { UserSummary } from '../api/types';

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_USERNAME = 'admin';
const DEMO_PASSWORD = 'admin123';

const TOKEN_KEY = 'pl_token';
const USER_KEY = 'pl_user';
const DEMO_WORKSPACE_KEY = 'pl_demo_workspace_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const cached = localStorage.getItem(USER_KEY);

    if (!token || !cached) {
      setLoading(false);
      return;
    }

    try {
      const cachedUser = JSON.parse(cached) as UserSummary;

      if (!cachedUser?.id || !cachedUser?.role) {
        throw new Error('Invalid cached user');
      }

      setUser(cachedUser);

      api.me()
        .then((currentUser) => {
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
          setUser(currentUser);
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        })
        .finally(() => setLoading(false));

    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    const isDemoLogin =
      username.trim().toLowerCase() === DEMO_USERNAME &&
      password === DEMO_PASSWORD;

    // Reuse the visitor's saved workspace token on subsequent logins.
    const savedWorkspaceToken = isDemoLogin
      ? localStorage.getItem(DEMO_WORKSPACE_KEY) || undefined
      : undefined;

    const response = await api.login(
      username,
      password,
      savedWorkspaceToken
    );

    const { token, user: loggedInUser, demo_workspace_token } = response;

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));

    // Save the server-issued token for future demo logins.
    if (loggedInUser.is_demo && demo_workspace_token) {
      localStorage.setItem(DEMO_WORKSPACE_KEY, demo_workspace_token);
    }

    setUser(loggedInUser);
  }

  function logout() {
    // Remove authentication, but preserve the demo workspace token.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setUser(null);
  }

  const isAdmin = user?.role === 'admin';
  const isDemo = user?.role === 'demo';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
