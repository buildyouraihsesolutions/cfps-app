'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LETTERS, type Options } from '@/lib/types';

type Round = {
  id: number; seq: number; kind: 'mcq' | 'locate' | 'index'; source: 'bank' | 'toc'; prompt: string; options: Options | null;
  asks_page: boolean; status: 'pending' | 'open' | 'closed' | 'revealed'; time_limit: number; time_left: number | null;
  my_answer: Record<string, string | number> | null;
  result: null | { answer: { letter?: string; section?: number; chapter?: number; page?: number | null; term?: string; pages?: string | null }; correct: boolean; points: number; explanation: string | null; fph_page: string | null };
};
const IDX = ['A', 'B', 'C'] as const;
const kindLabel = (r: Round) =>
  r.kind === 'index' ? 'Index hunt' : r.kind === 'mcq' ? 'Quick quiz' : r.source === 'toc' ? 'Find the chapter' : 'Find it in the FPH';
type State = { session: { id: number; title: string } | null; me?: { points: number; rank: number | null; players: number; correct: number }; round?: Round | null };

export default function LivePlayer() {
  const sb = useRef(supabaseBrowser()).current;
  const [st, setSt] = useState<State | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [letter, setLetter] = useState('');
  const [sec, setSec] = useState(''); const [ch, setCh] = useState(''); const [pg, setPg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const roundId = useRef<number | null>(null);

  const poll = useCallback(async () => {
    const { data, error } = await sb.rpc('cfps_live_state');
    if (error) return setErr(error.message);
    const s = data as State;
    setErr('');
    setSt(s);
    const r = s.round;
    if (r && r.id !== roundId.current) {             // new round → reset the form
      roundId.current = r.id; setLetter(''); setSec(''); setCh(''); setPg('');
    }
    setLeft(r && r.status === 'open' && r.time_left != null ? r.time_left : null);
  }, [sb]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [poll]);
  useEffect(() => {
    if (left == null || left <= 0) return;
    const t = setTimeout(() => setLeft((x) => (x == null ? x : Math.max(0, x - 1))), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function submit(answer: Record<string, string | number>) {
    if (!st?.round) return;
    setBusy(true); setErr('');
    const { error } = await sb.rpc('cfps_live_answer', { p_round: st.round.id, p_answer: answer });
    setBusy(false);
    if (error) return setErr(error.message);
    poll();
  }

  if (!st) return <div className="card" style={{ marginTop: 24 }}>Connecting…</div>;
  if (!st.session) {
    return (
      <div className="hero" style={{ textAlign: 'center' }}>
        <h1>Live class</h1>
        <p>No live activity right now. When your instructor starts one, it will appear here automatically.</p>
      </div>
    );
  }
  const r = st.round;
  const me = st.me!;
  const answered = !!r?.my_answer;

  return (
    <div style={{ maxWidth: 680, margin: '20px auto' }}>
      <div className="card live-top">
        <div><b>{st.session.title}</b><div className="sub" style={{ margin: 0 }}>{me.rank ? `Rank ${me.rank} of ${me.players}` : 'Not ranked yet'}</div></div>
        <div className="live-score">{me.points}<span>points</span></div>
      </div>

      {!r && <div className="card" style={{ textAlign: 'center' }}><h2>Get ready!</h2><p className="sub">Waiting for the first question…</p></div>}

      {r && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="pill">{kindLabel(r)} · Q{r.seq}</span>
            {r.status === 'open' && left != null && <span className={`timer ${left <= 10 ? 'low' : ''}`}>{left}s</span>}
          </div>

          {r.kind === 'locate' && (
            <p className="sub" style={{ marginTop: 0 }}>
              {r.source === 'toc' ? 'Where is this chapter in the Fire Protection Handbook?' : 'Find the section, chapter and page that answer this question:'}
            </p>
          )}
          {r.kind === 'index' && (
            <p className="sub" style={{ marginTop: 0 }}>Which index keyword would lead you to the answer? Don&apos;t answer the question yet — just pick where to look.</p>
          )}
          <div className="stem live-prompt">{r.prompt}</div>

          {/* answering */}
          {r.status === 'open' && !answered && left !== 0 && (
            r.kind === 'index' ? (
              <div>
                {IDX.map((L) => (
                  <button key={L} className={`opt ${letter === L ? 'sel' : ''}`} disabled={busy} onClick={() => { setLetter(L); submit({ letter: L }); }}>
                    <span className="L">{L}.</span><span>{r.options?.[L as keyof Options]}</span>
                  </button>
                ))}
              </div>
            ) : r.kind === 'mcq' ? (
              <div>
                {LETTERS.map((L) => (
                  <button key={L} className={`opt ${letter === L ? 'sel' : ''}`} disabled={busy} onClick={() => { setLetter(L); submit({ letter: L }); }}>
                    <span className="L">{L}.</span><span>{r.options?.[L]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit({ section: Number(sec), chapter: Number(ch), ...(r.asks_page ? { page: Number(pg) } : {}) }); }}>
                <div className="live-grid">
                  <div><label>Section</label>
                    <select required value={sec} onChange={(e) => setSec(e.target.value)}>
                      <option value="">—</option>{Array.from({ length: 21 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select></div>
                  <div><label>Chapter</label><input type="text" inputMode="numeric" required pattern="[0-9]{1,2}" value={ch} onChange={(e) => setCh(e.target.value.replace(/\D/g, ''))} /></div>
                  {r.asks_page && <div><label>Page</label><input type="text" inputMode="numeric" required pattern="[0-9]{1,4}" value={pg} onChange={(e) => setPg(e.target.value.replace(/\D/g, ''))} placeholder={sec ? `${sec}-…` : ''} /></div>}
                </div>
                <button className="btn" style={{ marginTop: 14, width: '100%' }} disabled={busy}>{busy ? 'Sending…' : 'Submit answer'}</button>
                <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>Points: section 200 · chapter 300{r.asks_page ? ' · page (±2) 300' : ''} · faster = bonus.</p>
              </form>
            )
          )}

          {r.status !== 'revealed' && answered && <div className="okmsg live-wait">✓ Answer locked in. Wait for the reveal…</div>}
          {r.status !== 'revealed' && !answered && (r.status === 'closed' || left === 0) && <div className="err live-wait">Time&apos;s up for this question.</div>}

          {/* reveal */}
          {r.status === 'revealed' && r.result && (
            <div className={`live-result ${r.result.correct ? 'good' : r.result.points > 0 ? 'part' : 'bad'}`}>
              <div className="big-line">{r.result.correct ? 'Correct!' : r.result.points > 0 ? 'Partly right' : answered ? 'Not this time' : 'No answer'} · +{r.result.points}</div>
              {r.kind === 'index' ? (
                <>
                  <div>Keyword: <b>{r.result.answer.term}</b></div>
                  {r.result.answer.pages && <div style={{ marginTop: 4 }}>📖 In the index: <b>{r.result.answer.pages}</b>. Next: find the exact page.</div>}
                </>
              ) : r.kind === 'mcq'
                ? <div>Answer: <b>{r.result.answer.letter}. {r.options?.[r.result.answer.letter as keyof Options]}</b></div>
                : <div>Answer: <b>Section {r.result.answer.section} · Chapter {r.result.answer.section}.{r.result.answer.chapter}{r.result.answer.page ? ` · page ${r.result.answer.section}-${r.result.answer.page}` : ''}</b></div>}
              {r.result.explanation && <div className="expl">{r.result.explanation}{r.result.fph_page && <div style={{ marginTop: 6 }}><b>FPH:</b> page {r.result.fph_page}</div>}</div>}
            </div>
          )}
          {err && <div className="err">{err}</div>}
        </div>
      )}
    </div>
  );
}
