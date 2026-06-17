import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { API_ENDPOINTS } from '@/constants/api';

// Tampilkan notifikasi sebagai banner meski app sedang foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
        if (!savedToken) return;

        // Zero-trust: jangan langsung percaya data di device.
        // Validasi token ke server sekalian ambil fresh user data.
        const res = await fetch(API_ENDPOINTS.profile, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!res.ok) {
          // Token expired / revoked — hapus session lokal.
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('auth_user');
          return;
        }

        const json = await res.json();
        const freshUser = json.status === 'success' && json.data ? json.data : null;
        if (!freshUser) {
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('auth_user');
          return;
        }

        // Simpan fresh data dari server ke SecureStore & state.
        await SecureStore.setItemAsync('auth_user', JSON.stringify(freshUser));
        setToken(savedToken);
        setUser(freshUser);
        registerPushToken(savedToken);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function registerPushToken(authToken: string) {
    try {
      if (Platform.OS === 'web') return;
      const { status: existing } = await Notifications.getPermissionsAsync();
      const { status } = existing === 'granted'
        ? { status: existing }
        : await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
      await fetch(API_ENDPOINTS.deviceToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ device_token: expoPushToken }),
      });
    } catch {
      // Best-effort — jangan blokir login kalau push gagal didaftarkan.
    }
  }

  async function signIn(newToken: string, newUser: User) {
    await SecureStore.setItemAsync('auth_token', newToken);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    registerPushToken(newToken);
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
