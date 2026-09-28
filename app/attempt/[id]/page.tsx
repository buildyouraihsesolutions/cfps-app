import { redirect, notFound } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import Runner from './Runner';
import type { Attempt, AttemptQ } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const sb = supabaseServer();
  const { data: attempt } = await sb.from('cfps_attempts').select('*').eq('id', params.id).maybeSingle();
  if (!attempt) notFound();
  if (attempt.submitted_at) redirect(`/attempt/${params.id}/review`);
  const { data: qs } = await sb.rpc('cfps_attempt_questions', { p_attempt: params.id });
  return <Runner attempt={attempt as Attempt} questions={(qs ?? []) as AttemptQ[]} serverNow={Date.now()} />;
}
