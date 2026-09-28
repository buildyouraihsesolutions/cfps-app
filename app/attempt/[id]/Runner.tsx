'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LETTERS, type Attempt, type AttemptQ } from '@/lib/types';

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}`;
};

export default function Runner({ attempt, questions, serverNow }: { attempt: Attempt; questions: AttemptQ[]; serverNow: number }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, string | null>>(() => Object.fromEntries(questions.map((q) => [q.pos, q.chosen])));
  const [flags, setFlags] = useState<Record<number, boolean>>(() => Object.fromEntries(questions.map((q) => [q.pos, q.flagged])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const skew = useRef(serverNow - Date.now());
  const deadline = attempt.time_limit_sec ? new Date(attempt.started_at).getTime() + attempt.time_limit_sec * 1000 : null;
  const [left, setLeft] = useState<number | null>(deadline ? Math.max(0, Math.floor((deadline - serverNow) / 1000)) : null);
  const submitted = useRef(false);

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    if (!auto) {
      const blank = questions.filter((q) => !ans[q.pos]).length;
      if (!confirm(blank ? `${blank} question(s) are unanswered. Submit anyway?` : 'Submit your answers?')) return;
    }
    submitted.current = true;
    setBusy(true);
    const { error } = await sb.rpc('cfps_submit_attempt', { p_attempt: attempt.id });
    if (error) { submitted.current = false; setBusy(false); return setErr(error.message); }
    router.replace(`/attempt/${attempt.id}/review`);
  }, [ans, attempt.id, questions, router, sb]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((deadline - (Date.now() + skew.current)) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); submit(true); }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, submit]);

  const q = questions[i];
  async function choose(letter: string) {
    setAns((a) => ({ ...a, [q.pos]: letter }));
    const { error } = await sb.rpc('cfps_save_answer', { p_attempt: attempt.id, p_pos: q.pos, p_choice: letter, p_flagged: null });
    if (error) setErr(error.message); else setErr('');
  }
  async function toggleFlag() {
    const v = !flags[q.pos];
    setFlags((f) => ({ ...f, [q.pos]: v }));
    await sb.rpc('cfps_save_answer', { p_attempt: attempt.id, p_pos: q.pos, p_choice: null, p_flagged: v });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  return (
    <div style={{ marginTop: 20 }}>
      <div className="qwrap">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="pill">Question {i + 1} of {questions.length}</span>
            <button className="btn sm ghost" onClick={toggleFlag}>{flags[q.pos] ? '🚩 Flagged' : '⚑ Flag for review'}</button>
          </div>
          <div className="stem">{q.stem}</div>
          {LETTERS.map((L) => (
            <button key={L} className={`opt ${ans[q.pos] === L ? 'sel' : ''}`} onClick={() => choose(L)}>
              <span className="L">{L}.</span><span>{q.options[L]}</span>
            </button>
          ))}
          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
            {i < questions.length - 1
              ? <button className="btn navy" onClick={() => setI(i + 1)}>Next →</button>
              : <button className="btn" disabled={busy} onClick={() => submit(false)}>Submit</button>}
          </div>
          {err && <div className="err">{err}</div>}
        </div>

        <div className="card" style={{ position: 'sticky', top: 12 }}>
          {left !== null && (
            <>
              <div className="sub" style={{ margin: 0 }}>Time left</div>
              <div className={`timer ${left < 300 ? 'low' : ''}`}>{clock(left)}</div>
            </>
          )}
          <div className="sub" style={{ margin: '8px 0' }}>{answered} / {questions.length} answered</div>
          <div className="navgrid">
            {questions.map((x, k) => (
              <button key={x.pos} className={`${ans[x.pos] ? 'ans' : ''} ${flags[x.pos] ? 'flag' : ''} ${k === i ? 'cur' : ''}`} onClick={() => setI(k)}>{k + 1}</button>
            ))}
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={busy} onClick={() => submit(false)}>{busy ? 'Submitting…' : 'Submit exam'}</button>
          <p className="sub" style={{ fontSize: 12, marginTop: 10 }}>Keys: A–D to answer, ← → to move. Answers save automatically.</p>
        </div>
      </div>
    </div>
  );
}
