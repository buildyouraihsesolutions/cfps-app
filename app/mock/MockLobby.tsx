'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { EXAM_TZ_LABEL, countdown, fmtDateTime, fmtDuration, fmtTime, type MockStatus } from '@/lib/mock';

const ERRORS: Record<string, string> = {
  NOT_OPEN_YET: 'The exam is not open yet.',
  EXAM_CLOSED: 'The exam window has closed.',
  ALREADY_TAKEN: 'You have already taken this exam. It can only be taken once.',
};

export default function MockLobby({ status, justSubmitted }: { status: MockStatus; justSubmitted: boolean }) {
  const router = useRouter();
  const { exam, sitting } = status;
  const skew = useRef(new Date(status.server_now).getTime() - Date.now());
  const now = () => Date.now() + skew.current;

  const [tick, setTick] = useState(now());
  const [agreed, setAgreed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const opens = new Date(exam.opens_at).getTime();
  const closes = new Date(exam.closes_at).getTime();
  const state = tick < opens ? 'not_open' : tick < closes ? 'open' : 'closed';

  useEffect(() => {
    const t = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(t);
  }, []);

  // refresh from the server the moment the window opens or closes
  const lastState = useRef(state);
  useEffect(() => {
    if (lastState.current !== state) { lastState.current = state; router.refresh(); }
  }, [state, router]);

  const inProgress = !!sitting && !sitting.submitted_at && new Date(sitting.deadline).getTime() > tick;
  const done = !!sitting && !inProgress;

  async function start() {
    setBusy(true); setErr('');
    const { data, error } = await supabaseBrowser().rpc('cfps_mock_start', { p_exam: exam.id });
    if (error || !data) {
      setBusy(false); setConfirming(false);
      const key = Object.keys(ERRORS).find((k) => error?.message?.includes(k));
      return setErr(key ? ERRORS[key] : error?.message ?? 'Could not start the exam. Try again.');
    }
    router.push(`/mock/${data}`);
  }

  const instructions = useMemo(() => (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Instructions — please read carefully</h3>

      <h4 style={{ marginBottom: 6 }}>About the exam</h4>
      <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
        <li><strong>{exam.question_count} multiple-choice questions</strong> in <strong>{fmtDuration(exam.duration_min)}</strong>, spread across the 8 CFPS domains in the same proportions as the real exam.</li>
        <li><strong>One attempt only.</strong> Once you press Start, the exam counts as taken and cannot be restarted.</li>
        <li>Every participant gets a <strong>different set of questions in a different order</strong>. This is an individual assessment: do not work with colleagues.</li>
        <li>As in the real CFPS exam, you may use your <strong>Fire Protection Handbook (FPH)</strong>. No other help is allowed: no colleagues, no phone calls or chat, no AI tools.</li>
        <li><strong>No score or feedback is shown</strong>, during or after the exam. Results go to the course instructor and your company.</li>
      </ul>

      <h4 style={{ marginBottom: 6 }}>Before you start</h4>
      <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
        <li><strong>Laptop fully charged and plugged into power</strong> for the whole {fmtDuration(exam.duration_min)}.</li>
        <li><strong>A stable internet connection.</strong> Keep a mobile hotspot ready as a backup.</li>
        <li>Use a <strong>laptop or desktop</strong> with an up-to-date Chrome or Edge browser. Do not use a phone.</li>
        <li>Turn off sleep mode and postpone system updates. Close other tabs and programs.</li>
        <li>Sit somewhere quiet where you will not be interrupted, with your FPH and a calculator.</li>
      </ul>

      <h4 style={{ marginBottom: 6 }}>During the exam</h4>
      <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
        <li>The <strong>timer starts when you press Start and runs on the server</strong>. It does not stop if you close the browser, lose internet or lose power.</li>
        <li>Each answer is <strong>saved automatically</strong> when you click it. A question number outlined in red means its answer has not been saved yet.</li>
        <li>If you are disconnected, reconnect as fast as you can, sign in again and open <strong>Mock exam → Resume</strong>. Your saved answers are kept, but lost time is not added back.</li>
        <li>Use <strong>Flag for review</strong> to mark questions to come back to. You can move freely between questions.</li>
        <li><strong>Unanswered questions count as wrong</strong>, so answer every question before time runs out.</li>
        <li>When the time is up, the exam is <strong>submitted automatically</strong> with the answers saved so far.</li>
      </ul>
    </div>
  ), [exam]);

  return (
    <>
      <div className="hero">
        <h1>{exam.title}</h1>
        <p>
          Available from <strong>{fmtDateTime(exam.opens_at)}</strong> to <strong>{fmtDateTime(exam.closes_at)}</strong> ({EXAM_TZ_LABEL}).
          {' '}{exam.question_count} questions · {fmtDuration(exam.duration_min)} · one attempt.
        </p>
      </div>

      {/* ---- finished ---- */}
      {done && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>✅ {justSubmitted ? 'Your exam has been submitted' : 'You have completed this exam'}</h3>
          <p className="sub" style={{ margin: 0 }}>
            Submitted on {fmtDateTime(sitting!.submitted_at ?? sitting!.deadline)} ({EXAM_TZ_LABEL}).
            Thank you. Results are not shown on the platform; the course instructor will share them with your company.
          </p>
        </div>
      )}

      {/* ---- in progress: resume ---- */}
      {inProgress && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Your exam is in progress</h3>
          <p className="sub">
            Started at {fmtTime(sitting!.started_at)} · ends at <strong>{fmtTime(sitting!.deadline)}</strong> ({EXAM_TZ_LABEL}).
            Time left: <strong suppressHydrationWarning>{countdown(Math.max(0, Math.floor((new Date(sitting!.deadline).getTime() - tick) / 1000)))}</strong>
          </p>
          <button className="btn" onClick={() => router.push(`/mock/${sitting!.id}`)}>Resume exam →</button>
        </div>
      )}

      {/* ---- not open yet ---- */}
      {!sitting && state === 'not_open' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>The exam opens in</h3>
          <div className="timer" suppressHydrationWarning>{countdown(Math.max(0, Math.floor((opens - tick) / 1000)))}</div>
          <p className="sub" style={{ marginBottom: 0 }}>Read the instructions below now, so you are ready on the day.</p>
        </div>
      )}

      {/* ---- closed, never started ---- */}
      {!sitting && state === 'closed' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>The exam window has closed</h3>
          <p className="sub" style={{ margin: 0 }}>You did not start the exam during the window. Contact the course instructor if this was due to a problem.</p>
        </div>
      )}

      {/* ---- open, not started ---- */}
      {!sitting && state === 'open' && (
        <div className="card" style={{ marginTop: 16, borderLeft: '4px solid #F8984D' }}>
          <h3 style={{ marginTop: 0 }}>The exam is open now</h3>
          <p className="sub">
            You can start any time before <strong>{fmtDateTime(exam.closes_at)}</strong> ({EXAM_TZ_LABEL}).
            Once you start you will have the full {fmtDuration(exam.duration_min)}.
          </p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 'normal', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
            <span>I have read the instructions below. My laptop is charged and plugged in, my internet is stable, and I understand I can take this exam only once.</span>
          </label>
          <div style={{ marginTop: 14 }}>
            <button className="btn" disabled={!agreed || busy} onClick={() => setConfirming(true)}>Start the exam</button>
          </div>
          {err && <div className="err">{err}</div>}
        </div>
      )}

      {!done && instructions}

      {confirming && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => !busy && setConfirming(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
        >
          <div className="card" style={{ maxWidth: 440, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Start the exam now?</h3>
            <p className="sub">
              The {fmtDuration(exam.duration_min)} timer starts immediately and cannot be paused.
              This is your only attempt.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn ghost" disabled={busy} onClick={() => setConfirming(false)}>Not yet</button>
              <button className="btn" disabled={busy} onClick={start}>{busy ? 'Preparing your exam…' : 'Start now'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
