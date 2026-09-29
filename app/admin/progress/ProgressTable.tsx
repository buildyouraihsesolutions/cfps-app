'use client';
import { useMemo, useState } from 'react';
import type { Domain } from '@/lib/types';

export type ProgressRow = {
  sn: number; full_name: string; company: string; email: string | null;
  sessions: number; exams: number; full_100q: number;
  questions_seen: number; bank_pct: number; first_try_pct: number | null;
  last_exam_pct: number | null; best_full_pct: number | null;
  domain_pct: Record<string, { pct: number; n: number }>;
  weakest_domain: string | null; weakest_pct: number | null;
  last_active: string | null; verdict: 0 | 1 | 2 | 3;
};

const VERDICT = [
  { label: 'Not started', bg: '#eceef3', fg: '#5B5E73' },
  { label: 'Not ready', bg: '#fdecea', fg: '#D93025' },
  { label: 'Close', bg: '#fff4d6', fg: '#8a6100' },
  { label: 'Ready', bg: '#eaf6ef', fg: '#1E8E5A' },
];
type SortKey = 'sn' | 'full_name' | 'company' | 'sessions' | 'full_100q' | 'questions_seen' | 'first_try_pct' | 'last_exam_pct' | 'last_active' | 'verdict';

const cellColor = (p: number | undefined) =>
  p == null ? 'transparent' : p >= 75 ? '#cfeedd' : p >= 65 ? '#fff0c2' : '#fbd5d0';
const daysAgo = (iso: string | null) => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

export default function ProgressTable({ rows, domains }: { rows: ProgressRow[]; domains: Domain[] }) {
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'verdict', dir: -1 });

  const counts = [0, 1, 2, 3].map((v) => rows.filter((r) => r.verdict === v).length);
  const withAccount = rows.filter((r) => r.email).length;

  const shown = useMemo(() => {
    const list = filter === 'all' ? rows : rows.filter((r) => r.verdict === filter);
    return [...list].sort((a, b) => {
      const x = a[sort.k] ?? -1, y = b[sort.k] ?? -1;
      if (x === y) return (b.first_try_pct ?? -1) - (a.first_try_pct ?? -1);
      return (x > y ? 1 : -1) * sort.dir;
    });
  }, [rows, filter, sort]);

  const th = (k: SortKey, label: string) => (
    <th className="nowrap" style={{ cursor: 'pointer' }} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))}>
      {label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  function exportCsv() {
    const head = ['S/N', 'Name', 'Company', 'Email', 'Sessions', 'Exams', 'Full 100-Q exams', 'Questions seen', 'Bank %',
      'First-try %', 'Last exam %', 'Best full exam %', ...domains.map((d) => `Domain ${d.code} %`), 'Weakest domain', 'Last active', 'Verdict'];
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = rows.map((r) => [r.sn, r.full_name, r.company, r.email ?? 'no account', r.sessions, r.exams, r.full_100q, r.questions_seen,
      r.bank_pct, r.first_try_pct, r.last_exam_pct, r.best_full_pct, ...domains.map((d) => r.domain_pct[d.code]?.pct),
      r.weakest_domain ? `${r.weakest_domain} (${r.weakest_pct}%)` : '', r.last_active ? r.last_active.slice(0, 10) : '', VERDICT[r.verdict].label].map(esc).join(','));
    const blob = new Blob(['\uFEFF' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CFPS_GroupD_progress_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card"><div className="sub" style={{ margin: 0 }}>Accounts created</div><div className="timer">{withAccount} / {rows.length}</div></div>
        {[3, 2, 1, 0].map((v) => (
          <button key={v} className="card" onClick={() => setFilter(filter === v ? 'all' : v)}
            style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', background: filter === v ? VERDICT[v].bg : '#fff', borderColor: filter === v ? VERDICT[v].fg : undefined }}>
            <div className="sub" style={{ margin: 0 }}>{VERDICT[v].label}</div>
            <div className="timer" style={{ color: VERDICT[v].fg }}>{counts[v]}</div>
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14, fontSize: 13 }}>
        <b>Ready</b> = 200+ different questions answered, 2+ full 100-question exams, first-try accuracy ≥ 75% and last exam ≥ 75%.
        {' '}<b>Close</b> = 100+ questions and first-try ≥ 65%.
        {' '}<b>First-try %</b> counts only the first time a student saw each question, so repeated questions do not inflate the score.
        <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <span className="sub" style={{ margin: 0 }}>{filter === 'all' ? `Showing all ${rows.length}` : `Showing ${VERDICT[filter].label} (${shown.length}) — click the card again to clear`}</span>
          <button className="btn sm navy" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="t prog">
          <thead>
            <tr>
              {th('sn', '#')}
              {th('full_name', 'Student')}
              {th('questions_seen', 'Activity')}
              {th('first_try_pct', 'First-try')}
              {th('last_exam_pct', 'Last exam')}
              {domains.map((d) => <th key={d.code} title={d.name} className="dom">{d.code}</th>)}
              {th('last_active', 'Active')}
              {th('verdict', 'Verdict')}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.sn}>
                <td>{r.sn}</td>
                <td className="who">
                  <b>{r.full_name}</b>
                  <div>{r.company}</div>
                  <div className="em">{r.email ?? 'no account yet'}</div>
                </td>
                <td className="act">
                  {r.questions_seen} seen ({r.bank_pct}%)
                  <div>{r.full_100q} full · {r.sessions} sessions</div>
                </td>
                <td style={{ background: cellColor(r.first_try_pct ?? undefined), fontWeight: 'bold', textAlign: 'center' }}>{r.first_try_pct != null ? `${r.first_try_pct}%` : '—'}</td>
                <td style={{ textAlign: 'center' }}>{r.last_exam_pct != null ? `${r.last_exam_pct}%` : '—'}</td>
                {domains.map((d) => {
                  const c = r.domain_pct[d.code];
                  return (
                    <td key={d.code} className="dom" title={c ? `${d.name}: ${c.n} questions answered` : 'no data'}
                      style={{ background: c && c.n >= 5 ? cellColor(c.pct) : 'transparent' }}>
                      {c ? c.pct : '—'}
                    </td>
                  );
                })}
                <td className="nowrap">{daysAgo(r.last_active)}</td>
                <td><span className="pill nowrap" style={{ background: VERDICT[r.verdict].bg, color: VERDICT[r.verdict].fg, borderColor: VERDICT[r.verdict].fg }}>{VERDICT[r.verdict].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ fontSize: 12, marginTop: 10 }}>Domain columns show first-try % per blueprint domain (hover for the domain name). Cells are coloured after 5+ answers: green ≥ 75% · amber 65–74% · red &lt; 65%. On small screens the domain columns are hidden.</p>
    </>
  );
}
