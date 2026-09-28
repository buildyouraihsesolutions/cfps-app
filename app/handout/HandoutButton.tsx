'use client';
import { useState } from 'react';

export default function HandoutButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/handout', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Download failed');
      window.location.href = body.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="btn" onClick={go} disabled={busy}>{busy ? 'Preparing your copy…' : 'Download my handout (PDF)'}</button>
      {err && <div className="err">{err}</div>}
    </>
  );
}
