import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import AdminPanel from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isAdmin) redirect('/');
  const sb = supabaseServer();
  const [r, ro, al] = await Promise.all([
    sb.from('cfps_access_requests').select('*').order('created_at', { ascending: false }),
    sb.from('cfps_roster').select('*').order('id'),
    sb.from('cfps_allowed_emails').select('*'),
  ]);
  return (
    <>
      <h1 className="page">Admin — access</h1>
      <p className="sub">Approve students after checking the suggested roster match. Name and company scores are similarity from 0 to 1.</p>
      <AdminPanel requests={r.data ?? []} roster={ro.data ?? []} allowed={al.data ?? []} />
    </>
  );
}
