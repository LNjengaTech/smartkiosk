import { redirect } from 'next/navigation';

// src/app/(dashboard)/settings/page.tsx
// Purpose: Redirect settings landing page to the notifications preferences page.

export default function SettingsPage() {
  redirect('/settings/notifications');
}
