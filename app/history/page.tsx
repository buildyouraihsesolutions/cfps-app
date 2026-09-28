import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import type { Attempt } from '@/lib/types';

export const dynamic = 'force-dynamic';

const label = (a: Attempt) => {
  const f = a.filter as { domain?: string; section?: number; chapter?: number };
  if (a.mode === 'exam') return `Exam simulation · ${a.question_count} Qs`;
  if (a.mode === 'domain') return `Domain ${f.domain} · ${a.question_count} Qs`;
  return `Section ${f.section}${f.chapter ? `.${f.chapter}` : ''} · ${a.question_count} Qs`;
};

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const { data } = await supabaseServer().from('cfps_attempts').select('*').order('started_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as Attempt[];
  return (
    <>
      <h1 className="page">My results</h1>
      <p className="sub">Every practice session you have started.</p>
      {rows.length === 0 ? <div className="card">No attempts yet. <Link href="/practice">Start practising</Link>.</div> : (
        <table className="t">
          <thead><tr><th>Date</th><th>Practice</th><th>Score</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => {
              const pct = a.score != null ? Math.round((a.score / a.question_count) * 100) : null;
              return (
                <tr key={a.id}>
                  <td>{new Date(a.started_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{label(a)}</td>
                  <td>{pct != null ? <span className={`pill ${pct >= 70 ? 'ok' : 'bad'}`}>{pct}%</span> : <span className="pill">In progress</span>}</td>
                  <td><Link href={a.submitted_at ? `/attempt/${a.id}/review` : `/attempt/${a.id}`}>{a.submitted_at ? 'Review' : 'Continue'}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
