// src/lib/stores/auth-store.ts
// Purpose: Zustand auth state store — manages session token, user profile, and shop context.
//          Uses persist middleware with skipHydration to prevent SSR/client mismatch.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser, AuthShop, RoleName } from '@/types/api';

// ─── State Interface ──────────────────────────────────────────────────────────

interface AuthState {
  // Session data
  token: string | null;
  user: AuthUser | null;
  shop: AuthShop | null;

  // Hydration flag — prevents SSR mismatch
  _hasHydrated: boolean;

  // Actions
  setSession: (token: string, user: AuthUser, shop: AuthShop | null) => void;
  clearSession: () => void;
  setUser: (user: AuthUser) => void;
  setShop: (shop: AuthShop) => void;
  setHasHydrated: (state: boolean) => void;

  // Derived helpers
  isAuthenticated: () => boolean;
  hasRole: (role: RoleName) => boolean;
  hasAnyRole: (roles: RoleName[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

// ─── Store Definition ─────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      shop: null,
      _hasHydrated: false,

      // ── Actions ──────────────────────────────────────────────────────────────

      setSession: (token, user, shop) => {
        // Persist token to localStorage for Axios interceptor access
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('smartkiosk_token', token);
        }
        set({ token, user, shop });
      },

      clearSession: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('smartkiosk_token');
        }
        set({ token: null, user: null, shop: null });
      },

      setUser: (user) => set({ user }),
      setShop: (shop) => set({ shop }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // ── Derived Helpers ───────────────────────────────────────────────────────

      isAuthenticated: () => {
        const { token, user } = get();
        return token !== null && user !== null;
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.roles.includes(role) ?? false;
      },

      hasAnyRole: (roles) => {
        const { user } = get();
        return roles.some((role) => user?.roles.includes(role)) ?? false;
      },

      hasPermission: (permission) => {
        const { user } = get();
        return user?.permissions.includes(permission) ?? false;
      },
    }),
    {
      name: 'smartkiosk-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({} as Storage),
      ),
      // Only persist these fields — never hydrate token to avoid XSS risk in state
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        shop: state.shop,
      }),
      // Prevents SSR/client hydration mismatch — call rehydrate() in client layout
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
