import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import StudyPlan from './StudyPlan';
import type { Domain, PlanRow, PoolRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const sb = supabaseServer();
  const [d, p, c] = await Promise.all([
    sb.from('cfps_domains').select('*').order('sort'),
    sb.from('cfps_study_plan').select('*').order('sort'),
    sb.rpc('cfps_pool_counts'),
  ]);
  return (
    <>
      <h1 className="page">Study plan</h1>
      <p className="sub">CFPS blueprint 2024 mapped to the Fire Protection Handbook, 21st edition. Tick chapters as you complete them. Your progress is saved on this device.</p>
      <StudyPlan domains={(d.data ?? []) as Domain[]} plan={(p.data ?? []) as PlanRow[]} pool={(c.data ?? []) as PoolRow[]} />
    </>
  );
}
