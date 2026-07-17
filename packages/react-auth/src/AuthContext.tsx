import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AuthClient, AuthLoginResult, AuthRegisterInput } from './types.js';

export interface AuthContextValue<User> {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthLoginResult>;
  completeMfaLogin: (mfaToken: string, code: string) => Promise<{ passwordInsecure?: boolean; passwordSecurityReasons?: string[] }>;
  register: (input: AuthRegisterInput) => Promise<string>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue<unknown> | null>(null);

export function createAuthProvider<User>(client: AuthClient<User>, normalizeUser?: (user: User) => User) {
  return function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const refreshGen = useRef(0);

    const mapUser = useCallback((value: User) => (normalizeUser ? normalizeUser(value) : value), []);

    const refreshUser = useCallback(async (): Promise<User | null> => {
      const gen = ++refreshGen.current;
      try {
        const me = await client.getCurrentUser();
        const normalized = mapUser(me);
        setUser(normalized);
        return normalized;
      } catch {
        if (gen !== refreshGen.current) return null;
        setUser(null);
        return null;
      } finally {
        if (gen === refreshGen.current) setLoading(false);
      }
    }, [mapUser]);

    useEffect(() => {
      void refreshUser();
    }, [refreshUser]);

    const login = useCallback(
      async (email: string, password: string): Promise<AuthLoginResult> => {
        const result = await client.login(email, password);
        if (result.needsMfa) return result;
        await refreshUser();
        return result;
      },
      [refreshUser]
    );

    const completeMfaLogin = useCallback(
      async (mfaToken: string, code: string) => {
        const result = await client.completeMfaLogin(mfaToken, code);
        await refreshUser();
        return result;
      },
      [refreshUser]
    );

    const register = useCallback(async (input: AuthRegisterInput) => {
      const msg = await client.register(input);
      await refreshUser();
      return msg;
    }, [refreshUser]);

    const logout = useCallback(async () => {
      try {
        await client.logout();
      } finally {
        setUser(null);
      }
    }, []);

    return (
      <AuthContext.Provider
        value={{ user, loading, login, completeMfaLogin, register, logout, refreshUser } as AuthContextValue<unknown>}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

export function useAuth<User>() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx as AuthContextValue<User>;
}
