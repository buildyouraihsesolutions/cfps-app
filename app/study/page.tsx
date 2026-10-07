import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import Study from './Study';
import type { Domain, PlanRow, PoolRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { section?: string; chapter?: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const sb = supabaseServer();
  const [d, p, c, ch, u] = await Promise.all([
    sb.from('cfps_domains').select('*').order('sort'),
    sb.from('cfps_study_plan').select('*').order('id'),
    sb.rpc('cfps_pool_counts'),
    sb.from('cfps_chapter_pages').select('section, chapter, chapter_name'),
    sb.auth.getUser(),
  ]);
  return (
    <>
      <h1 className="page">Study questions</h1>
      <p className="sub">Read through questions with their model answers and explanations. Nothing here is scored.</p>
      <Study
        domains={(d.data ?? []) as Domain[]}
        plan={(p.data ?? []) as PlanRow[]}
        pool={(c.data ?? []) as PoolRow[]}
        chapterNames={(ch.data ?? []) as { section: number; chapter: number; chapter_name: string | null }[]}
        email={u.data.user?.email ?? ''}
        initSection={searchParams.section ? Number(searchParams.section) : undefined}
        initChapter={searchParams.chapter ? Number(searchParams.chapter) : undefined}
      />
    </>
  );
}
