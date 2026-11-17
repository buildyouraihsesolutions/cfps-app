import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import MockRunner from './MockRunner';
import type { MockQ, MockStatus } from '@/lib/mock';

export const dynamic = 'force-dynamic';

export default async function MockAttemptPage({ params }: { params: { id: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const sb = supabaseServer();

  const { data: st } = await sb.rpc('cfps_mock_status');
  const status = st as MockStatus | null;
  const sitting = status?.sitting;
  // not my sitting, or already finished → back to the lobby
  if (!status || !sitting || sitting.id !== params.id || sitting.submitted_at) redirect('/mock');

  const { data: qs, error } = await sb.rpc('cfps_mock_questions', { p_sitting: params.id });
  if (error) redirect('/mock');   // SUBMITTED or TIME_UP

  return (
    <MockRunner
      sittingId={params.id}
      title={status.exam.title}
      deadline={sitting.deadline}
      serverNow={status.server_now}
      questions={(qs ?? []) as MockQ[]}
    />
  );
}
