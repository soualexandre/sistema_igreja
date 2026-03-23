"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authApi, type AuthUser } from "@/lib/auth-api";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: "admin" | "teacher" | "student";
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      signIn: async (email, password) => {
        const r = await authApi.login(email, password);
        set({ token: r.token, user: r.user });
      },
      signUp: async (payload) => {
        const r = await authApi.register(payload);
        set({ token: r.token, user: r.user });
      },
      signOut: () => set({ token: null, user: null }),
      refreshUser: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const user = await authApi.me(token);
          set({ user });
        } catch {
          set({ token: null, user: null });
        }
      },
    }),
    {
      name: "ebd-web-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);

export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useAuthStore.persist.hasHydrated()) finish();
    return useAuthStore.persist.onFinishHydration(finish);
  }, []);
  return hydrated;
}
