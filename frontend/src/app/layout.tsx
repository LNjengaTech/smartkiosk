// src/app/layout.tsx
// Purpose: Root application layout. Configures providers, fonts, dark mode,
//          React Query, and Sonner toast notifications.

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

// ─── Font ─────────────────────────────────────────────────────────────────────
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// ─── SEO Metadata ─────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: 'SmartKiosk — Offline-First Retail POS',
    template: '%s | SmartKiosk',
  },
  description:
    'SmartKiosk is a modern, offline-first point-of-sale and inventory management platform built for small businesses across Africa.',
  keywords: ['POS', 'retail', 'inventory', 'kiosk', 'Africa', 'offline', 'sales'],
  authors: [{ name: 'SmartKiosk' }],
  robots: { index: false, follow: false }, // Private SaaS — no public indexing
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fc' },
    { media: '(prefers-color-scheme: dark)',  color: '#090d1a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash dark mode script — runs before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('smartkiosk-theme');
                  var theme = stored ? JSON.parse(stored) : null;
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
