// src/components/shared/role-gate.tsx
// Purpose: Client-side RBAC gate that conditionally renders children based on
//          the authenticated user's roles and permissions. Falls back to a
//          customizable fallback node or null.

'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { RoleName } from '@/types/api';

interface RoleGateProps {
  /** Render children only if user has ALL of these roles */
  roles?: RoleName[];
  /** Render children if user has ANY of these roles */
  anyRole?: RoleName[];
  /** Render children only if user has ALL of these permissions */
  permissions?: string[];
  /** Content to render when access is granted */
  children: ReactNode;
  /** Content to render when access is denied (defaults to null) */
  fallback?: ReactNode;
}

export function RoleGate({
  roles,
  anyRole,
  permissions,
  children,
  fallback = null,
}: RoleGateProps) {
  const { user, _hasHydrated } = useAuthStore();

  // Don't render during SSR hydration — prevents flicker
  if (!_hasHydrated) return null;

  if (!user) return <>{fallback}</>;

  // Check all-roles requirement
  if (roles && roles.length > 0) {
    const hasAllRoles = roles.every((role) => user.roles.includes(role));
    if (!hasAllRoles) return <>{fallback}</>;
  }

  // Check any-role requirement
  if (anyRole && anyRole.length > 0) {
    const hasAnyRole = anyRole.some((role) => user.roles.includes(role));
    if (!hasAnyRole) return <>{fallback}</>;
  }

  // Check permissions requirement
  if (permissions && permissions.length > 0) {
    const hasAllPermissions = permissions.every((perm) =>
      user.permissions.includes(perm),
    );
    if (!hasAllPermissions) return <>{fallback}</>;
  }

  return <>{children}</>;
}
