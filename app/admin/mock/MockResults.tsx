'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { EXAM_TZ_LABEL, fmtDateTime, fmtTime, type MockExam, type MockResult } from '@/lib/mock';

const PASS = 70;   // program readiness benchmark (not an official NFPA pass mark)

const tone = (p: number | null) =>
  p == null ? undefined : p >= PASS ? '#e3f1ea' : p >= 60 ? '#fdf0e3' : '#f9e1e1';

function domPct(r: MockResult, code: string) {
  const d = r.domains?.[code];
  return d && d.total ? Math.round((100 * d.correct) / d.total) : null;
}

export default function MockResults({ exams, exam, rows, domains }: {
  exams: MockExam[]; exam: MockExam; rows: MockResult[]; domains: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [resetFor, setResetFor] = useState<MockResult | null>(null);

  const done = rows.filter((r) => r.pct != null);
  const inProg = rows.filter((r) => r.status === 'In progress').length;
  const notStarted = rows.filter((r) => r.status === 'Not started').length;
  const avg = done.length ? Math.round(done.reduce((t, r) => t + (r.pct ?? 0), 0) / done.length) : null;
  const ready = done.filter((r) => (r.pct ?? 0) >= PASS).length;
  const domAvg = (code: string) => {
    const v = done.map((r) => domPct(r, code)).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  function downloadCsv() {
    const head = ['Name', 'Email', 'Company', 'Status', 'Started', 'Submitted', 'Minutes used', 'Answered',
      'Score', 'Questions', 'Percent', 'Result', ...domains.map((d) => `Domain ${d.code} %`)];
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = rows.map((r) => [
      r.full_name, r.email, r.company, r.status, fmtDateTime(r.started_at), fmtDateTime(r.submitted_at),
      r.minutes_used, r.answered, r.score, r.question_count, r.pct,
      r.pct == null ? '' : r.pct >= PASS ? 'Ready' : 'Not ready',
      ...domains.map((d) => domPct(r, d.code)),
    ].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${exam.title.replace(/\s+/g, '_')}_results.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doReset(r: MockResult) {
    setBusy(r.email); setErr('');
    const { error } = await supabaseBrowser().rpc('cfps_mock_reset', { p_exam: exam.id, p_email: r.email });
    setBusy(''); setResetFor(null);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>{exam.title}</h3>
            <p className="sub" style={{ margin: '4px 0 0' }}>
              {fmtDateTime(exam.opens_at)} → {fmtDateTime(exam.closes_at)} ({EXAM_TZ_LABEL}) · {exam.question_count} questions · {exam.duration_min} min
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {exams.length > 1 && (
              <select value={exam.id} onChange={(e) => router.push(`/admin/mock?exam=${e.target.value}`)}>
                {exams.map((x) => <option key={x.id} value={x.id}>{x.title} · {fmtDateTime(x.opens_at)}</option>)}
              </select>
            )}
            <button className="btn ghost" onClick={() => router.refresh()}>Refresh</button>
            <button className="btn" onClick={downloadCsv}>Download CSV</button>
          </div>
        </div>

        <table className="t" style={{ marginTop: 14 }}>
          <tbody>
            <tr><td>Participants on the roster</td><td>{rows.length}</td></tr>
            <tr><td>Submitted</td><td>{done.length}</td></tr>
            <tr><td>In progress now</td><td>{inProg}</td></tr>
            <tr><td>Not started</td><td>{notStarted}</td></tr>
            <tr><td>Average score (submitted)</td><td>{avg == null ? '—' : `${avg}%`}</td></tr>
            <tr><td>Scored {PASS}% or more</td><td>{done.length ? `${ready} of ${done.length}` : '—'}</td></tr>
          </tbody>
        </table>
        <p className="sub" style={{ fontSize: 12 }}>
          {PASS}% is the program&apos;s readiness benchmark, not an official NFPA pass mark. Students never see these results.
        </p>
      </div>

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Results by participant</h3>
        <table className="t" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>#</th><th>Participant</th><th>Company</th><th>Status</th><th>Time</th><th>Answered</th><th>Score</th>
              {domains.map((d) => <th key={d.code} title={d.name} style={{ textAlign: 'center' }}>{d.code}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={r.email}>
                <td>{k + 1}</td>
                <td>{r.full_name ?? '—'}<div className="sub" style={{ fontSize: 12, margin: 0 }}>{r.email}</div></td>
                <td>{r.company ?? '—'}</td>
                <td>
                  {r.status}
                  {r.started_at && <div className="sub" style={{ fontSize: 12, margin: 0 }}>{fmtTime(r.started_at)}–{r.submitted_at ? fmtTime(r.submitted_at) : '…'}</div>}
                </td>
                <td>{r.minutes_used != null ? `${r.minutes_used} min` : '—'}</td>
                <td>{r.question_count ? `${r.answered}/${r.question_count}` : '—'}</td>
                <td style={{ background: tone(r.pct), fontWeight: 600 }}>{r.pct != null ? `${r.pct}% (${r.score})` : '—'}</td>
                {domains.map((d) => {
                  const p = domPct(r, d.code);
                  const t = r.domains?.[d.code];
                  return (
                    <td key={d.code} style={{ textAlign: 'center', background: tone(p) }} title={t ? `${t.correct}/${t.total}` : ''}>
                      {p == null ? '—' : `${p}%`}
                    </td>
                  );
                })}
                <td>
                  {r.status !== 'Not started' && (
                    <button className="btn sm ghost" disabled={busy === r.email} onClick={() => setResetFor(r)}>Allow retake</button>
                  )}
                </td>
              </tr>
            ))}
            {done.length > 0 && (
              <tr style={{ fontWeight: 600 }}>
                <td></td><td>Group average</td><td></td><td></td><td></td><td></td>
                <td style={{ background: tone(avg) }}>{avg}%</td>
                {domains.map((d) => { const a = domAvg(d.code); return <td key={d.code} style={{ textAlign: 'center', background: tone(a) }}>{a == null ? '—' : `${a}%`}</td>; })}
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
        {err && <div className="err">{err}</div>}
      </div>

      {resetFor && (
        <div role="dialog" aria-modal="true" onClick={() => setResetFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 440, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Allow {resetFor.full_name ?? resetFor.email} to retake?</h3>
            <p className="sub">
              This permanently deletes their current sitting{resetFor.pct != null ? ` and its score (${resetFor.pct}%)` : ''}.
              They can then start a fresh exam with new questions, but only while the exam window is still open.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setResetFor(null)}>Cancel</button>
              <button className="btn" disabled={!!busy} onClick={() => doReset(resetFor)}>Delete sitting</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
