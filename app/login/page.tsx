'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(error.message);
    setStage('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setErr('That code is not valid or has expired. Request a new one.');
    window.location.href = '/';
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto' }}>
      <div className="hero" style={{ marginBottom: 16 }}>
        <h1>Welcome</h1>
        <p>Sign in with your email. We will send you a one-time code.</p>
      </div>
      <div className="card">
        {stage === 'email' ? (
          <form onSubmit={sendCode}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" />
            <div style={{ marginTop: 16 }}>
              <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p style={{ marginTop: 0 }}>We sent an 8-digit code to <b>{email}</b>. Check your inbox (and spam folder).</p>
            <label htmlFor="code">Code</label>
            <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{8}" maxLength={8}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="12345678" />
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
              <button type="button" className="btn ghost" onClick={() => { setStage('email'); setCode(''); }}>Use another email</button>
            </div>
          </form>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}
