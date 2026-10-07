'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LETTERS, type Options } from '@/lib/types';

type Kind = 'mcq' | 'locate' | 'index';
type RoundRow = { id: number; seq: number; kind: Kind; source: 'bank' | 'toc'; status: string; prompt: string; time_limit: number };
type Cur = {
  id: number; seq: number; kind: Kind; source: 'bank' | 'toc'; prompt: string; options: Options | null;
  answer: { letter?: string; section?: number; chapter?: number; page?: number | null; term?: string; pages?: string | null }; status: string; time_limit: number; time_left: number | null;
  answers: number; distribution: Record<string, number> | null; fastest: { name: string; company: string; ms: number; points: number }[];
  explanation: string | null; fph_page: string | null; chapter_title: string | null;
};
type Host = {
  session: { id: number; title: string; status: string } | null; past?: { id: number; title: string; created_at: string }[];
  rounds?: RoundRow[]; round?: Cur | null; students?: number;
  board?: { name: string; company: string; points: number; correct: number; answered: number; rank: number }[];
  companies?: { company: string; players: number; avg: number }[];
};

const TYPES = [
  { v: 'toc', label: 'Find the chapter (table of contents)', kind: 'locate', source: 'toc', time: 45 },
  { v: 'locate', label: 'Find it in the FPH (section, chapter, page)', kind: 'locate', source: 'bank', time: 90 },
  { v: 'mcq', label: 'Quick quiz (multiple choice)', kind: 'mcq', source: 'bank', time: 45 },
  { v: 'index', label: 'Index hunt (pick the keyword, then solve)', kind: 'index', source: 'bank', time: 30 },
];
const IDX = ['A', 'B', 'C'] as const;
const kindLabel = (k: string, s: string) =>
  k === 'index' ? 'Index hunt' : k === 'mcq' ? 'Quick quiz' : s === 'toc' ? 'Find the chapter' : 'Find it in the FPH';

export default function LiveHost() {
  const sb = useRef(supabaseBrowser()).current;
  const [h, setH] = useState<Host | null>(null);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('Day 1 — Find it in the FPH');
  const [type, setType] = useState('toc');
  const [count, setCount] = useState(5);
  const [section, setSection] = useState('');
  const [time, setTime] = useState(45);
  const [projector, setProjector] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const closing = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('cfps_live_host');
    if (error) return setErr(error.message);
    setErr(''); setH(data as Host);
    const r = (data as Host).round;
    setLeft(r && r.status === 'open' && r.time_left != null ? r.time_left : null);
  }, [sb]);
  useEffect(() => { load(); const t = setInterval(load, 1500); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (left == null) return;
    if (left <= 0) {                                  // auto-close when the timer runs out
      const r = h?.round;
      if (r && r.status === 'open' && closing.current !== r.id) { closing.current = r.id; act(r.id, 'close'); }
      return;
    }
    const t = setTimeout(() => setLeft((x) => (x == null ? x : x - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProjector(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function call(fn: string, args: Record<string, unknown>) {
    const { error } = await sb.rpc(fn, args);
    if (error) setErr(error.message); else load();
  }
  const act = (id: number, a: 'open' | 'close' | 'reveal') => call('cfps_live_set', { p_round: id, p_action: a });

  if (!h) return <div className="card">Loading…</div>;

  if (!h.session || h.session.status !== 'active') {
    return (
      <div className="card" style={{ maxWidth: 620 }}>
        <h3>Start a live activity</h3>
        <p className="sub">Students open <b>Live class</b> on their phones and join automatically. You run it from here on the projector.</p>
        <label>Session title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ marginTop: 14 }}><button className="btn" onClick={() => call('cfps_live_create_session', { p_title: title })}>Start session</button></div>
        {err && <div className="err">{err}</div>}
        {!!h.past?.length && <p className="sub" style={{ marginTop: 16 }}>Earlier sessions: {h.past.map((p) => p.title).join(' · ')}</p>}
      </div>
    );
  }

  const r = h.round;
  const rounds = h.rounds ?? [];
  const next = rounds.find((x) => x.status === 'pending' && (!r || x.seq > r.seq)) ?? rounds.find((x) => x.status === 'pending');
  const maxDist = r?.distribution ? Math.max(1, ...Object.values(r.distribution)) : 1;
  const revealed = r?.status === 'revealed';

  const stage = (
    <div className={`card ${projector ? 'proj' : ''}`}>
      {!r ? (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <div className="proj-title">{h.session.title}</div>
          <p className="sub">Ask students to open <b>cfps.infinitehse.com → Live class</b>.</p>
          {next && <button className="btn" onClick={() => act(next.id, 'open')}>Start question 1</button>}
        </div>
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="pill">{kindLabel(r.kind, r.source)} · Q{r.seq} of {rounds.length}</span>
            <span className="sub" style={{ margin: 0 }}>{r.answers} / {h.students} answered</span>
            {r.status === 'open' && left != null && <span className={`timer ${left <= 10 ? 'low' : ''}`}>{left}s</span>}
          </div>
          {r.kind === 'locate' && <p className="sub" style={{ marginBottom: 4 }}>{r.source === 'toc' ? 'Where is this chapter?' : 'Find the section, chapter and page that answer:'}</p>}
          {r.kind === 'index' && <p className="sub" style={{ marginBottom: 4 }}>Which index keyword would lead you to the answer?</p>}
          <div className="proj-prompt">{r.prompt}</div>
          {r.kind === 'locate' && r.status === 'open' && (
            <div className="sub" style={{ marginTop: 10, fontSize: 18 }}>
              📱 Answer on your phone: <b>Section</b> · <b>Chapter</b>{r.answer.page != null ? <> · <b>Page</b></> : null}
            </div>
          )}

          {r.kind === 'index' && IDX.map((L) => {
            const n = r.distribution?.[L] ?? 0;
            const ok = revealed && r.answer.letter === L;
            return (
              <div key={L} className={`opt ${ok ? 'correct' : ''}`} style={{ cursor: 'default', position: 'relative', overflow: 'hidden' }}>
                {r.status !== 'open' && <div className="distbar" style={{ width: `${(100 * n) / maxDist}%` }} />}
                <span className="L">{L}.</span><span style={{ flex: 1 }}>{r.options?.[L as keyof Options]}</span>
                {r.status !== 'open' && <b>{n}</b>}
              </div>
            );
          })}

          {r.kind === 'mcq' && LETTERS.map((L) => {
            const n = r.distribution?.[L] ?? 0;
            const ok = revealed && r.answer.letter === L;
            return (
              <div key={L} className={`opt ${ok ? 'correct' : ''}`} style={{ cursor: 'default', position: 'relative', overflow: 'hidden' }}>
                {r.status !== 'open' && <div className="distbar" style={{ width: `${(100 * n) / maxDist}%` }} />}
                <span className="L">{L}.</span><span style={{ flex: 1 }}>{r.options?.[L]}</span>
                {r.status !== 'open' && <b>{n}</b>}
              </div>
            );
          })}

          {r.kind === 'locate' && r.status !== 'open' && r.distribution && (
            <div className="row" style={{ marginTop: 12 }}>
              <span className="pill">Right section: <b>{r.distribution.section}</b></span>
              <span className="pill">Right chapter: <b>{r.distribution.chapter}</b></span>
              {r.answer.page != null && <span className="pill">Right page (±2): <b>{r.distribution.page}</b></span>}
            </div>
          )}

          {revealed && (
            <div className="live-result good" style={{ marginTop: 12 }}>
              {r.kind === 'index' ? (
                <>
                  <div className="big-line">Keyword: {r.answer.term}</div>
                  {r.answer.pages && <div style={{ marginTop: 4 }}>📖 In the index: <b>{r.answer.pages}</b>. Next: find the page together.</div>}
                </>
              ) : r.kind === 'locate'
                ? <div className="big-line">Section {r.answer.section} · Chapter {r.answer.section}.{r.answer.chapter}{r.answer.page ? ` · page ${r.answer.section}-${r.answer.page}` : ''}{r.chapter_title && r.source !== 'toc' ? ` — ${r.chapter_title}` : ''}</div>
                : <div className="big-line">Answer: {r.answer.letter}</div>}
              {r.explanation && <div className="expl">{r.explanation}{r.fph_page && <div style={{ marginTop: 6 }}><b>FPH:</b> page {r.fph_page}</div>}</div>}
              {!!r.fastest.length && <div style={{ marginTop: 10 }}>⚡ Fastest correct: {r.fastest.map((f, i) => <b key={i}>{i ? ' · ' : ''}{f.name} ({(f.ms / 1000).toFixed(1)}s)</b>)}</div>}
            </div>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            {r.status === 'open' && <button className="btn navy" onClick={() => act(r.id, 'close')}>Stop answers</button>}
            {(r.status === 'open' || r.status === 'closed') && <button className="btn" onClick={() => act(r.id, 'reveal')}>Reveal answer</button>}
            {revealed && next && <button className="btn" onClick={() => act(next.id, 'open')}>Next question →</button>}
            {revealed && !next && <span className="sub" style={{ margin: 0 }}>No more questions — add more or show the final leaderboard.</span>}
            <span style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => setProjector(!projector)}>{projector ? 'Exit projector (Esc)' : 'Projector view'}</button>
          </div>
        </>
      )}
    </div>
  );

  const boards = (
    <div className={`grid ${projector ? 'proj-boards' : ''}`} style={{ marginTop: 14 }}>
      <div className="card">
        <h3>🏆 Leaderboard</h3>
        {!h.board?.length ? <p className="sub">Scores appear after the first reveal.</p> : (
          <table className="t"><tbody>
            {h.board.map((b) => (
              <tr key={b.rank + b.name}><td style={{ width: 30 }}><b>{b.rank}</b></td><td><b>{b.name}</b><div className="sub" style={{ margin: 0, fontSize: 12 }}>{b.company}</div></td><td style={{ textAlign: 'right' }}><b>{b.points}</b><div className="sub" style={{ margin: 0, fontSize: 12 }}>{b.correct}/{b.answered} correct</div></td></tr>
            ))}
          </tbody></table>
        )}
      </div>
      <div className="card">
        <h3>🏢 Companies (average points)</h3>
        {!h.companies?.length ? <p className="sub">—</p> : (
          <table className="t"><tbody>
            {h.companies.map((c, i) => <tr key={c.company}><td style={{ width: 30 }}>{i + 1}</td><td>{c.company}<div className="sub" style={{ margin: 0, fontSize: 12 }}>{c.players} player{c.players > 1 ? 's' : ''}</div></td><td style={{ textAlign: 'right' }}><b>{c.avg}</b></td></tr>)}
          </tbody></table>
        )}
      </div>
    </div>
  );

  if (projector) {
    return <div className="proj-wrap">{stage}{boards}</div>;
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <b>{h.session.title}</b>
        <button className="btn sm ghost" onClick={() => { if (confirm('End this session? Final scores are kept.')) call('cfps_live_end_session', { p_session: h.session!.id }); }}>End session</button>
      </div>
      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      {stage}
      {boards}

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Add questions</h3>
        <div className="live-grid">
          <div style={{ gridColumn: 'span 2' }}><label>Activity</label>
            <select value={type} onChange={(e) => { setType(e.target.value); setTime(TYPES.find((t) => t.v === e.target.value)!.time); }}>
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select></div>
          <div><label>How many</label><input type="text" inputMode="numeric" value={count} onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 1)))} /></div>
          <div><label>FPH section</label>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Any section</option>{Array.from({ length: 21 }, (_, i) => <option key={i + 1} value={i + 1}>Section {i + 1}</option>)}
            </select></div>
          <div><label>Seconds each</label><input type="text" inputMode="numeric" value={time} onChange={(e) => setTime(Math.max(10, Math.min(600, Number(e.target.value.replace(/\D/g, '')) || 10)))} /></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => {
          const t = TYPES.find((x) => x.v === type)!;
          sb.rpc('cfps_live_add_rounds', { p_session: h.session!.id, p_kind: t.kind, p_count: count, p_section: section ? Number(section) : null, p_time: time, p_source: t.source })
            .then(({ data, error }) => {
              if (error) return setErr(error.message);
              setErr(data === 0
                ? (t.kind === 'index'
                    ? 'No approved index sets left for this selection. Approve more in cfps_index_items, or pick another section.'
                    : 'No new questions left for this selection.')
                : '');
              load();
            });
        }}>Add {count} question{count > 1 ? 's' : ''}</button>
        <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>
          {type === 'index'
            ? 'Each index hunt adds 2 rounds: pick the right index keyword (this time), then find the section, chapter and page in the FPH (at least 90 s).'
            : 'Questions are not repeated within a session. Tip: after teaching a section, add 3–5 questions from that section.'}
        </p>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 0 }}>
        <table className="t">
          <thead><tr><th>#</th><th>Activity</th><th>Question</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rounds.length === 0 && <tr><td colSpan={5} className="sub">No questions yet — add some above.</td></tr>}
            {rounds.map((x) => (
              <tr key={x.id} style={r?.id === x.id ? { background: '#fff5f2' } : undefined}>
                <td>{x.seq}</td><td style={{ fontSize: 12 }}>{kindLabel(x.kind, x.source)}<div className="sub" style={{ margin: 0 }}>{x.time_limit}s</div></td>
                <td style={{ fontSize: 13 }}>{x.prompt}</td>
                <td><span className={`pill ${x.status === 'revealed' ? 'ok' : ''}`}>{x.status}</span></td>
                <td className="nowrap">
                  {x.status === 'pending' && <button className="btn sm" onClick={() => act(x.id, 'open')}>Open</button>}{' '}
                  {x.status === 'pending' && <button className="btn sm ghost" onClick={() => call('cfps_live_delete_round', { p_round: x.id })}>✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
