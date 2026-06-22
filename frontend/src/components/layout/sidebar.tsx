// src/components/layout/sidebar.tsx
// Purpose: Main navigation sidebar with collapsible behavior and RBAC link visibility.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RoleGate } from '@/components/shared/role-gate';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowRightLeft,
  PieChart,
  Wallet,
  Truck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Folder,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/api/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['owner', 'manager', 'cashier'],
  },
  {
    title: 'Point of Sale',
    href: '/pos',
    icon: ShoppingCart,
    roles: ['owner', 'manager', 'cashier'],
  },
  {
    title: 'Products',
    href: '/products',
    icon: Package,
    roles: ['owner', 'manager'],
  },
  {
    title: 'Categories',
    href: '/products/categories',
    icon: Folder,
    roles: ['owner', 'manager'],
  },
  {
    title: 'Stock Movements',
    href: '/stock',
    icon: ArrowRightLeft,
    roles: ['owner', 'manager'],
  },
  {
    title: 'Sales & Reports',
    href: '/reports',
    icon: PieChart,
    roles: ['owner', 'manager'],
  },
  {
    title: 'Expenses',
    href: '/expenses',
    icon: Wallet,
    roles: ['owner', 'manager'],
  },
  {
    title: 'Suppliers',
    href: '/suppliers',
    icon: Truck,
    roles: ['owner'],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['owner'],
  },
] as const;

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();
  const { user, shop, clearSession } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      clearSession();
      router.push('/login');
    } catch {
      toast.error('Failed to log out cleanly, clearing local session.');
      clearSession();
      router.push('/login');
    }
  };

  return (
    <aside
      className={cn(
        'group relative flex flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg transition-all duration-300 z-40',
        isExpanded ? 'w-64' : 'w-20'
      )}
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-sidebar-border">
        {isExpanded && (
          <div className="flex flex-col truncate">
            <span className="font-bold text-sidebar-accent truncate">
              {shop?.business_name || 'SmartKiosk'}
            </span>
            <span className="text-[10px] text-sidebar-muted uppercase tracking-wider">
              {user?.roles[0] || 'Staff'}
            </span>
          </div>
        )}
        {!isExpanded && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-sidebar-accent text-sidebar-bg font-bold">
            {shop?.business_name?.[0] || 'S'}
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          // Use exact match for top-level routes that have sub-routes sharing
          // the same prefix (e.g. /products should NOT activate for /products/categories).
          const isActive =
            item.href === '/products'
              ? pathname === '/products'
              : pathname.startsWith(item.href);
          return (
            <RoleGate key={item.href} anyRole={[...item.roles]}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent/10 text-sidebar-accent'
                    : 'text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-fg'
                )}
                title={!isExpanded ? item.title : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="truncate">{item.title}</span>}
              </Link>
            </RoleGate>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-border hover:text-destructive',
            !isExpanded && 'justify-center px-0'
          )}
          title={!isExpanded ? 'Log out' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isExpanded && <span>Log out</span>}
        </button>
      </div>

      {/* Expand/Collapse Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="absolute -right-4 top-20 z-50 h-8 w-8 rounded-full border-sidebar-border bg-sidebar-bg text-sidebar-fg shadow-md hover:bg-sidebar-border"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    </aside>
  );
}
