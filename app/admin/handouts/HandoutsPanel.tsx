'use client';
import { useCallback, useEffect, useState } from 'react';

type Row = { email: string; name: string; roster: number | null; userId: string | null; ready: boolean };
type Status = 'idle' | 'working' | 'done' | 'error';

export default function HandoutsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [version, setVersion] = useState('');
  const [state, setState] = useState<Record<string, { s: Status; msg?: string }>>({});
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/handouts', { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) return setErr(j.error || 'Could not load');
    setRows(j.students); setVersion(j.version);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function prepare(userId: string, force = false) {
    setState((s) => ({ ...s, [userId]: { s: 'working' } }));
    const r = await fetch('/api/admin/handouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, force }) });
    const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    if (!r.ok) { setState((s) => ({ ...s, [userId]: { s: 'error', msg: j.error || `HTTP ${r.status}` } })); return false; }
    setState((s) => ({ ...s, [userId]: { s: 'done', msg: j.created ? `${Math.round(j.ms / 1000)} s` : 'already ready' } }));
    setRows((rs) => rs.map((x) => (x.userId === userId ? { ...x, ready: true } : x)));
    return true;
  }

  async function prepareAll() {
    setRunning(true);
    for (const r of rows) {                       // one at a time — keeps every call well inside the server time limit
      if (!r.userId || r.ready) continue;
      await prepare(r.userId);
    }
    setRunning(false);
  }

  const ready = rows.filter((r) => r.ready).length;
  const withAccount = rows.filter((r) => r.userId).length;

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <b>Stamped handouts ready: {ready} / {withAccount}</b>
            <div className="sub" style={{ margin: 0 }}>Handout version {version}. Preparing copies in advance makes every student&apos;s download instant.</div>
          </div>
          <button className="btn" disabled={running || ready === withAccount} onClick={prepareAll}>
            {running ? 'Preparing…' : ready === withAccount ? 'All ready' : `Prepare ${withAccount - ready} copies`}
          </button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="t">
          <thead><tr><th>#</th><th>Student</th><th>Stamped copy</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = r.userId ? state[r.userId] : undefined;
              return (
                <tr key={r.email}>
                  <td>{r.roster ?? '—'}</td>
                  <td><b>{r.name}</b><div className="sub" style={{ margin: 0, fontSize: 12 }}>{r.email}</div></td>
                  <td>
                    {!r.userId ? <span className="pill">no account</span>
                      : st?.s === 'working' ? <span className="pill">preparing…</span>
                      : st?.s === 'error' ? <span className="pill bad">{st.msg}</span>
                      : r.ready ? <span className="pill ok">ready{st?.msg ? ` · ${st.msg}` : ''}</span>
                      : <span className="pill">not yet</span>}
                  </td>
                  <td>
                    {r.userId && (
                      <button className="btn sm ghost" disabled={running || st?.s === 'working'} onClick={() => prepare(r.userId!, r.ready)}>
                        {r.ready ? 'Re-stamp' : 'Prepare'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ fontSize: 12, marginTop: 10 }}>
        Students approved later get their copy stamped automatically on first download. When you replace the master handout, raise HANDOUT_VERSION in Vercel and prepare again.
      </p>
    </>
  );
}
