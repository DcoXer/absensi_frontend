import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { API_ENDPOINTS } from '@/constants/api';

export type User = {
  id: string;
  name: string;
  email: string;
  employee_id?: string;
  phone?: string;
  jabatan?: string | null;
  role?: 'admin' | 'employee';
  is_active?: boolean;
  has_face?: boolean;
  /** Backend-authoritative photo URL (or null if none uploaded). Never cache a client-local copy. */
  profile_photo_url?: string | null;
  created_at?: string;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  /** Merge fresh fields (e.g. from GET /profile) into the cached user, persisted to SecureStore. */
  updateUser: (patch: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync('auth_token');
        const savedUser = await SecureStore.getItemAsync('auth_user');
        if (savedToken) setToken(savedToken);
        if (savedUser) setUser(JSON.parse(savedUser));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function signIn(newToken: string, newUser: User) {
    await SecureStore.setItemAsync('auth_token', newToken);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  async function signOut() {
    // Zero-trust: ask the backend to revoke the Sanctum token, don't just
    // forget it locally — otherwise it stays valid server-side indefinitely.
    if (token) {
      try {
        await fetch(API_ENDPOINTS.logout, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort — proceed to clear local session even if offline/unreachable.
      }
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    setToken(null);
    setUser(null);
  }

  async function updateUser(patch: Partial<User>) {
    const next = user ? { ...user, ...patch } : (patch as User);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(next));
    setUser(next);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
