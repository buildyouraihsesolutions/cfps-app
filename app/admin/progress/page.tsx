import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import AdminTabs from '@/components/AdminTabs';
import ProgressTable, { type ProgressRow } from './ProgressTable';
import type { Domain } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isAdmin) redirect('/');
  const sb = supabaseServer();
  const [{ data, error }, { data: doms }] = await Promise.all([
    sb.rpc('cfps_admin_progress'),
    sb.from('cfps_domains').select('*').order('sort'),
  ]);
  return (
    <>
      <h1 className="page">Admin</h1>
      <AdminTabs active="progress" />
      {error ? <div className="card err">{error.message}</div> : (
        <ProgressTable rows={(data ?? []) as ProgressRow[]} domains={(doms ?? []) as Domain[]} />
      )}
    </>
  );
}
