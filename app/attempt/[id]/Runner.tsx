'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LETTERS, type Attempt, type AttemptQ } from '@/lib/types';

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}`;
};

// Reject if the server does not answer in time, so the page can never hang on "Submitting…"
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms)),
  ]);
}

export default function Runner({ attempt, questions, serverNow }: { attempt: Attempt; questions: AttemptQ[]; serverNow: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, string | null>>(() => Object.fromEntries(questions.map((q) => [q.pos, q.chosen])));
  const [flags, setFlags] = useState<Record<number, boolean>>(() => Object.fromEntries(questions.map((q) => [q.pos, q.flagged])));
  const [failed, setFailed] = useState<Record<number, true>>({});   // answers the server did not save
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');

  const skew = useRef(serverNow - Date.now());
  const deadline = attempt.time_limit_sec ? new Date(attempt.started_at).getTime() + attempt.time_limit_sec * 1000 : null;
  const [left, setLeft] = useState<number | null>(deadline ? Math.max(0, Math.floor((deadline - serverNow) / 1000)) : null);

  const submitted = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Refs so async code always sees the latest values
  const ansRef = useRef(ans); ansRef.current = ans;
  const failedRef = useRef(failed); failedRef.current = failed;

  // All saves run one after another: answers can't arrive out of order,
  // and submit can wait for the last click to be saved first.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueueSave = useCallback((pos: number, choice: string | null, flagged: boolean | null) => {
    const run = async () => {
      let ok = false;
      try {
        const { error } = await withTimeout(
          sb.rpc('cfps_save_answer', { p_attempt: attempt.id, p_pos: pos, p_choice: choice, p_flagged: flagged }),
          15000,
        );
        ok = !error;
      } catch { ok = false; }
      if (choice === null) {                       // flag-only save
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
      if (!ok) setErr('Some answers were not saved (marked in red). They will be retried when you submit.');
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  }, [attempt.id, sb]);

  const doSubmit = useCallback(async (auto: boolean) => {
    if (submitted.current) return;
    submitted.current = true;
    setConfirming(false);
    setBusy(true);
    setErr('');

    // 1) wait for every pending answer save
    await queue.current;

    // 2) retry answers that failed to save
    const retry = Object.keys(failedRef.current).map(Number);
    if (retry.length) {
      retry.forEach((pos) => enqueueSave(pos, ansRef.current[pos] ?? null, null));
      await queue.current;
    }
    const stillFailed = Object.keys(failedRef.current).length;
    if (stillFailed && !auto) {
      submitted.current = false;
      setBusy(false);
      return setErr(`${stillFailed} answer(s) could not be saved. Check your connection, then press Submit again.`);
    }

    // 3) submit (safe to retry: the server returns the same result if already submitted)
    try {
      const { error } = await withTimeout(sb.rpc('cfps_submit_attempt', { p_attempt: attempt.id }), 25000);
      if (error) throw new Error(error.message);
    } catch (e) {
      submitted.current = false;
      if (!mounted.current) return;
      setBusy(false);
      const msg = e instanceof Error && e.message === 'TIMEOUT'
        ? 'The server did not respond. Your answers are saved — press Submit again.'
        : `Submit failed: ${e instanceof Error ? e.message : 'unknown error'}. Press Submit again.`;
      return setErr(msg);
    }

    // 4) go to results; hard-navigate if client routing stalls
    const url = `/attempt/${attempt.id}/review`;
    router.replace(url);
    setTimeout(() => { if (mounted.current) window.location.assign(url); }, 4000);
  }, [attempt.id, enqueueSave, router, sb]);

  // Timer + auto-submit at zero
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((deadline - (Date.now() + skew.current)) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); doSubmit(true); }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, doSubmit]);

  const q = questions[i];
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
      if ((LETTERS as readonly string[]).includes(k)) choose(k);
      if (e.key === 'ArrowRight') setI((x) => Math.min(questions.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) return <p>No questions in this attempt.</p>;
  const answered = questions.filter((x) => ans[x.pos]).length;
  const blank = questions.length - answered;
  const unsaved = Object.keys(failed).length;

  const errBox = err && <div className="err">{err}</div>;

  return (
    <div style={{ marginTop: 20 }}>
      <div className="qwrap">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="pill">Question {i + 1} of {questions.length}</span>
            <button className="btn sm ghost" onClick={toggleFlag} disabled={locked}>{flags[q.pos] ? '🚩 Flagged' : '⚑ Flag for review'}</button>
          </div>
          <div className="stem">{q.stem}</div>
          {LETTERS.map((L) => (
            <button key={L} className={`opt ${ans[q.pos] === L ? 'sel' : ''}`} onClick={() => choose(L)} disabled={locked}>
              <span className="L">{L}.</span><span>{q.options[L]}</span>
            </button>
          ))}
          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
            {i < questions.length - 1
              ? <button className="btn navy" onClick={() => setI(i + 1)}>Next →</button>
              : <button className="btn" disabled={locked} onClick={() => setConfirming(true)}>{busy ? 'Submitting…' : 'Submit'}</button>}
          </div>
          {errBox}
        </div>

        <div className="card" style={{ position: 'sticky', top: 12 }}>
          {left !== null && (
            <>
              <div className="sub" style={{ margin: 0 }}>Time left</div>
              <div className={`timer ${left < 300 ? 'low' : ''}`}>{clock(left)}</div>
            </>
          )}
          <div className="sub" style={{ margin: '8px 0' }}>
            {answered} / {questions.length} answered{unsaved ? ` · ${unsaved} not saved` : ''}
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
          <p className="sub" style={{ fontSize: 12, marginTop: 10 }}>Keys: A–D to answer, ← → to move. Answers save automatically.</p>
        </div>
      </div>

      {/* In-page confirmation: browser confirm() is blocked in some in-app browsers (WhatsApp, LinkedIn) */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirming(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
        >
          <div className="card" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Submit your answers?</h3>
            <p className="sub">
              {blank
                ? `${blank} question(s) are unanswered and will be marked wrong.`
                : 'All questions are answered.'}
              {unsaved ? ` ${unsaved} answer(s) will be re-saved first.` : ''}
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
