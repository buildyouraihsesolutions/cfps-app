import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import Practice from './Practice';
import type { Domain, PlanRow, PoolRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { section?: string; chapter?: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const sb = supabaseServer();
  const [d, p, c, ch] = await Promise.all([
    sb.from('cfps_domains').select('*').order('sort'),
    sb.from('cfps_study_plan').select('*').order('sort'),
    sb.rpc('cfps_pool_counts'),
    sb.from('cfps_chapter_pages').select('section, chapter, chapter_name'),
  ]);
  return (
    <>
      <h1 className="page">Practice</h1>
      <p className="sub">Real exam pace is 1.8 minutes per question (100 questions in 3 hours). Pass mark: 70%.</p>
      <Practice
        domains={(d.data ?? []) as Domain[]}
        plan={(p.data ?? []) as PlanRow[]}
        pool={(c.data ?? []) as PoolRow[]}
        chapterNames={(ch.data ?? []) as { section: number; chapter: number; chapter_name: string | null }[]}
        initSection={searchParams.section ? Number(searchParams.section) : undefined}
        initChapter={searchParams.chapter ? Number(searchParams.chapter) : undefined}
      />
    </>
  );
}
