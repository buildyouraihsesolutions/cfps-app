'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Domain, PlanRow, PoolRow } from '@/lib/types';

const KEY = 'cfps-plan-done-v1';
type Filter = 'all' | 'high' | 'medium' | 'low' | 'todo';

export default function StudyPlan({ domains, plan, pool }: { domains: Domain[]; plan: PlanRow[]; pool: PoolRow[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(domains.map((d) => [d.code, true])));
  const setAll = (v: boolean) => setOpen(Object.fromEntries(domains.map((d) => [d.code, v])));

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore */ }
  }, []);
  function toggle(id: number) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const count = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of pool) {
      const k1 = `${r.fph_section}-${r.fph_chapter ?? 0}`;
      m.set(k1, (m.get(k1) ?? 0) + Number(r.n));
      const k0 = `${r.fph_section}-all`;
      m.set(k0, (m.get(k0) ?? 0) + Number(r.n));
    }
    return m;
  }, [pool]);

  const total = plan.length;
  const completed = plan.filter((p) => done[p.id]).length;

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><b>Overall progress:</b> {completed} / {total} chapters</div>
          <div className="row">
            <button className="btn sm ghost" onClick={() => setAll(true)}>Expand all</button>
            <button className="btn sm ghost" onClick={() => setAll(false)}>Collapse all</button>
          </div>
          <div className="seg">
            {(['all', 'high', 'medium', 'low', 'todo'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'todo' ? 'Not done' : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="bar good" style={{ marginTop: 10 }}><div style={{ width: `${total ? (completed / total) * 100 : 0}%` }} /></div>
        <div className="row" style={{ marginTop: 10, fontSize: 12 }}>
          <span className="chip high">High</span> read this chapter very well
          <span className="chip medium">Medium</span> know the main topics
          <span className="chip low">Low</span> know the headlines
        </div>
      </div>

      {domains.map((d) => {
        const rows = plan.filter((p) => p.domain === d.code);
        const shown = rows.filter((p) => filter === 'all' ? true : filter === 'todo' ? !done[p.id] : p.priority === filter);
        const dDone = rows.filter((p) => done[p.id]).length;
        return (
          <details key={d.code} className="card domain" open={!!open[d.code]}
            onToggle={(e) => { const v = (e.currentTarget as HTMLDetailsElement).open; if (v !== !!open[d.code]) setOpen((o) => ({ ...o, [d.code]: v })); }}>
            <summary>
              <span aria-hidden style={{ width: 14, color: 'var(--orange-600)' }}>{open[d.code] ? '▾' : '▸'}</span>
              <span className="code">{d.code}</span>
              <div style={{ flex: 1 }}>
                <b>{d.name}</b>
                <div className="bar good" style={{ marginTop: 6, maxWidth: 360 }}><div style={{ width: `${rows.length ? (dDone / rows.length) * 100 : 0}%` }} /></div>
              </div>
              <span className="w">{d.weight}% · {d.weight} Qs</span>
            </summary>
            {shown.length === 0 && <p className="sub" style={{ marginTop: 10 }}>Nothing to show for this filter.</p>}
            {shown.map((p) => {
              const n = p.chapter === 0 ? count.get(`${p.section}-all`) ?? 0 : count.get(`${p.section}-${p.chapter}`) ?? 0;
              const href = p.chapter === 0 ? `/practice?section=${p.section}` : `/practice?section=${p.section}&chapter=${p.chapter}`;
              return (
                <div key={p.id} className={`plan-item ${done[p.id] ? 'done' : ''}`}>
                  <input type="checkbox" checked={!!done[p.id]} onChange={() => toggle(p.id)} aria-label={`Mark ${p.title} as done`} style={{ marginTop: 4 }} />
                  <div>
                    <div className="t">{p.title}</div>
                    <div className="meta">FPH Section {p.section}{p.chapter ? ` · Chapter ${p.section}.${p.chapter}` : ' · all chapters'}</div>
                    {p.note && <div className="note">{p.note}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`chip ${p.priority}`}>{p.priority}</span>
                    {n > 0 && <div style={{ marginTop: 6 }}><Link className="btn sm ghost" href={href}>Practice ({n})</Link></div>}
                  </div>
                </div>
              );
            })}
          </details>
        );
      })}
    </>
  );
}
