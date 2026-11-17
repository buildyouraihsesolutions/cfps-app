'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { MockQ } from '@/lib/mock';

// Mock exam runner: no feedback, no score. Answers save one by one on the server.
const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}`;
};

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms)),
  ]);
}

export default function MockRunner({ sittingId, title, deadline, serverNow, questions }: {
  sittingId: string; title: string; deadline: string; serverNow: string; questions: MockQ[];
}) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, string | null>>(() => Object.fromEntries(questions.map((q) => [q.pos, q.chosen])));
  const [flags, setFlags] = useState<Record<number, boolean>>(() => Object.fromEntries(questions.map((q) => [q.pos, q.flagged])));
  const [failed, setFailed] = useState<Record<number, true>>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');
  const [online, setOnline] = useState(true);

  const skew = useRef(new Date(serverNow).getTime() - Date.now());
  const end = new Date(deadline).getTime();
  const secsLeft = () => Math.max(0, Math.floor((end - (Date.now() + skew.current)) / 1000));
  const [left, setLeft] = useState(secsLeft);

  const submitted = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const ansRef = useRef(ans); ansRef.current = ans;
  const failedRef = useRef(failed); failedRef.current = failed;
  const queue = useRef<Promise<void>>(Promise.resolve());

  const goLobby = useCallback(() => {
    const url = '/mock?done=1';
    router.replace(url);
    setTimeout(() => { if (mounted.current) window.location.assign(url); }, 4000);
  }, [router]);

  const enqueueSave = useCallback((pos: number, choice: string | null, flagged: boolean | null) => {
    const run = async () => {
      let ok = false; let msg = '';
      try {
        const { error } = await withTimeout(
          sb.rpc('cfps_mock_save', { p_sitting: sittingId, p_pos: pos, p_choice: choice, p_flagged: flagged }), 15000);
        ok = !error; msg = error?.message ?? '';
      } catch { ok = false; }
      if (msg.includes('TIME_UP') || msg.includes('SUBMITTED')) { submitted.current = true; goLobby(); return; }
      if (choice === null) {
        if (!ok && mounted.current) setErr('Could not save the flag. Check your connection.');
        return;
      }
      if (!mounted.current) return;
      setFailed((f) => {
        const n = { ...f };
        if (ok) delete n[pos]; else n[pos] = true;
        failedRef.current = n;
        return n;
      });
      if (!ok) setErr('Some answers were not saved (outlined in red). Check your internet; they will be retried.');
      else if (!Object.keys(failedRef.current).length) setErr('');
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  }, [sb, sittingId, goLobby]);

  const retryFailed = useCallback(async () => {
    const retry = Object.keys(failedRef.current).map(Number);
    if (!retry.length) return;
    retry.forEach((pos) => enqueueSave(pos, ansRef.current[pos] ?? null, null));
    await queue.current;
  }, [enqueueSave]);

  // connection indicator + automatic retry when the connection comes back
  useEffect(() => {
    const on = () => { setOnline(true); retryFailed(); };
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [retryFailed]);

  // warn before closing the tab during the exam
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (!submitted.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const doSubmit = useCallback(async (auto: boolean) => {
    if (submitted.current) return;
    submitted.current = true;
    setConfirming(false); setBusy(true); setErr('');

    await queue.current;
    await retryFailed();
    const stillFailed = Object.keys(failedRef.current).length;
    if (stillFailed && !auto) {
      submitted.current = false; setBusy(false);
      return setErr(`${stillFailed} answer(s) could not be saved. Check your connection, then press Submit again.`);
    }

    try {
      const { error } = await withTimeout(sb.rpc('cfps_mock_submit', { p_sitting: sittingId, p_auto: auto }), 25000);
      if (error) throw new Error(error.message);
    } catch (e) {
      if (auto) { goLobby(); return; }   // the server closes timed-out sittings by itself
      submitted.current = false;
      if (!mounted.current) return;
      setBusy(false);
      return setErr(e instanceof Error && e.message === 'TIMEOUT'
        ? 'The server did not respond. Your answers are saved — press Submit again.'
        : `Submit failed: ${e instanceof Error ? e.message : 'unknown error'}. Press Submit again.`);
    }
    goLobby();
  }, [sb, sittingId, retryFailed, goLobby]);

  useEffect(() => {
    const t = setInterval(() => {
      const s = secsLeft();
      setLeft(s);
      if (s === 0) { clearInterval(t); doSubmit(true); }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSubmit]);

  const q = questions[i];
  const letters = q ? Object.keys(q.options).filter((k) => q.options[k] != null && q.options[k] !== '').sort() : [];
  const locked = busy || confirming;

  function choose(letter: string) {
    if (locked || !q) return;
    setAns((a) => ({ ...a, [q.pos]: letter }));
    enqueueSave(q.pos, letter, null);
  }
  function toggleFlag() {
    if (locked || !q) return;
    const v = !flags[q.pos];
    setFlags((f) => ({ ...f, [q.pos]: v }));
    enqueueSave(q.pos, null, v);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming) { if (e.key === 'Escape') setConfirming(false); return; }
      if (busy) return;
      const k = e.key.toUpperCase();
      if (letters.includes(k)) choose(k);
      if (e.key === 'ArrowRight') setI((x) => Math.min(questions.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) return <p>No questions in this exam.</p>;
  const answered = questions.filter((x) => ans[x.pos]).length;
  const blank = questions.length - answered;
  const flagged = questions.filter((x) => flags[x.pos]).length;
  const unsaved = Object.keys(failed).length;
  const errBox = err && <div className="err">{err}</div>;

  return (
    <div style={{ marginTop: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <strong>{title}</strong>
        {!online && <span className="pill" style={{ background: '#c0392b', color: '#fff' }}>Offline — reconnect now; the timer keeps running</span>}
      </div>
      <div className="qwrap">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="pill">Question {i + 1} of {questions.length}</span>
            <button className="btn sm ghost" onClick={toggleFlag} disabled={locked}>{flags[q.pos] ? '🚩 Flagged' : '⚑ Flag for review'}</button>
          </div>
          <div className="stem">{q.stem}</div>
          {letters.map((L) => (
            <button key={L} className={`opt ${ans[q.pos] === L ? 'sel' : ''}`} onClick={() => choose(L)} disabled={locked}>
              <span className="L">{L}.</span><span>{q.options[L]}</span>
            </button>
          ))}
          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
            {i < questions.length - 1
              ? <button className="btn navy" onClick={() => setI(i + 1)}>Next →</button>
              : <button className="btn" disabled={locked} onClick={() => setConfirming(true)}>{busy ? 'Submitting…' : 'Submit exam'}</button>}
          </div>
          {errBox}
        </div>

        <div className="card" style={{ position: 'sticky', top: 12 }}>
          <div className="sub" style={{ margin: 0 }}>Time left</div>
          <div className={`timer ${left < 600 ? 'low' : ''}`} suppressHydrationWarning>{clock(left)}</div>
          <div className="sub" style={{ margin: '8px 0' }}>
            {answered} / {questions.length} answered{flagged ? ` · ${flagged} flagged` : ''}{unsaved ? ` · ${unsaved} not saved` : ''}
          </div>
          <div className="navgrid">
            {questions.map((x, k) => (
              <button
                key={x.pos}
                className={`${ans[x.pos] ? 'ans' : ''} ${flags[x.pos] ? 'flag' : ''} ${k === i ? 'cur' : ''}`}
                style={failed[x.pos] ? { outline: '2px solid #c0392b' } : undefined}
                onClick={() => setI(k)}
              >{k + 1}</button>
            ))}
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={locked} onClick={() => setConfirming(true)}>
            {busy ? 'Submitting…' : 'Submit exam'}
          </button>
          {errBox}
          <p className="sub" style={{ fontSize: 12, marginTop: 10 }}>
            Answers save automatically. No score is shown. Keys: {letters.join('–') || 'A–D'} to answer, ← → to move.
          </p>
        </div>
      </div>

      {confirming && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => setConfirming(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
        >
          <div className="card" style={{ maxWidth: 440, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Submit your exam?</h3>
            <p className="sub">
              {blank ? `${blank} question(s) are unanswered and will count as wrong. ` : 'All questions are answered. '}
              {flagged ? `${flagged} question(s) are still flagged. ` : ''}
              {unsaved ? `${unsaved} answer(s) will be re-saved first. ` : ''}
              After submitting you cannot change your answers or take the exam again.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Keep working</button>
              <button className="btn" onClick={() => doSubmit(false)}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
