import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { MeProvider } from '@/lib/use-me';
import './globals.css';

export const metadata: Metadata = { title: 'Ticketing workshop' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <MeProvider>
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </MeProvider>
      </body>
    </html>
  );
}
