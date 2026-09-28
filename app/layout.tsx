import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getContext } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'CFPS Preparation — Group D',
  description: 'CFPS preparation platform for Group D (Loss Prevention), Wave 3',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  return (
    <html lang="en">
      <body>
        <Header email={ctx?.email} isStudent={ctx?.isStudent} isAdmin={ctx?.isAdmin} />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
