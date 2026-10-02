import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase/server';
import AdminTabs from '@/components/AdminTabs';
import LiveHost from './LiveHost';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isAdmin) redirect('/');
  return (
    <>
      <h1 className="page">Admin</h1>
      <AdminTabs active="live" />
      <LiveHost />
    </>
  );
}
