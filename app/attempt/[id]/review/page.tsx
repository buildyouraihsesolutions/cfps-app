import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import ReviewList from './ReviewList';
import { PASS_MARK, type Attempt, type Domain, type ReviewQ } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  const sb = supabaseServer();
  const { data: a } = await sb.from('cfps_attempts').select('*').eq('id', params.id).maybeSingle();
  if (!a) notFound();
  if (!a.submitted_at) redirect(`/attempt/${params.id}`);
  const attempt = a as Attempt;
  const [{ data: rv }, { data: doms }] = await Promise.all([
    sb.rpc('cfps_attempt_review', { p_attempt: params.id }),
    sb.from('cfps_domains').select('*').order('sort'),
  ]);
  const pct = Math.round(((attempt.score ?? 0) / attempt.question_count) * 100);
  const domains = (doms ?? []) as Domain[];
  const bd = attempt.breakdown ?? {};

  return (
    <>
      <div className="hero">
        <h1>{pct}% · {attempt.score} / {attempt.question_count}</h1>
        <p>{pct >= PASS_MARK ? 'Above the 70% pass mark — well done.' : 'Below the 70% pass mark — review the explanations and the FPH pages below.'}</p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Results by domain</h3>
        <table className="t">
          <thead><tr><th>Domain</th><th>Score</th><th style={{ width: '40%' }}></th></tr></thead>
          <tbody>
            {domains.filter((d) => bd[d.code]).map((d) => {
              const r = bd[d.code]; const p = Math.round((r.correct / r.total) * 100);
              return (
                <tr key={d.code}>
                  <td>{d.code}. {d.name}</td><td>{r.correct} / {r.total} ({p}%)</td>
                  <td><div className={`bar ${p >= PASS_MARK ? 'good' : ''}`}><div style={{ width: `${p}%` }} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="btn" href="/practice">New practice</Link>
          <Link className="btn ghost" href="/history">All results</Link>
        </div>
      </div>
      <ReviewList items={(rv ?? []) as ReviewQ[]} />
    </>
  );
}
