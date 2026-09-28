'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Req = { id: number; email: string; full_name: string; company: string; matched_roster_id: number | null; name_score: number | null; company_score: number | null; status: string; created_at: string };
type Ros = { id: number; full_name: string; company: string; notes: string | null };
type Al = { email: string; roster_id: number | null; full_name: string; revoked_at: string | null };

const score = (v: number | null) => (v == null ? '—' : v.toFixed(2));

export default function AdminPanel({ requests, roster, allowed }: { requests: Req[]; roster: Ros[]; allowed: Al[] }) {
  const router = useRouter();
  const [pick, setPick] = useState<Record<number, number | ''>>(() => Object.fromEntries(requests.map((r) => [r.id, r.matched_roster_id ?? ''])));
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const linked = new Map(allowed.filter((a) => !a.revoked_at).map((a) => [a.roster_id, a.email]));
  const pending = requests.filter((r) => r.status === 'pending');

  async function decide(id: number, approve: boolean) {
    setBusy(id); setErr('');
    const rid = pick[id];
    if (approve && !rid) { setBusy(null); return setErr('Choose the roster name before approving.'); }
    const { error } = await supabaseBrowser().rpc('cfps_decide_request', { p_request_id: id, p_approve: approve, p_roster_id: rid || null });
    setBusy(null);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Pending requests ({pending.length})</h3>
        {pending.length === 0 ? <p className="sub">Nothing waiting.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="t">
              <thead><tr><th>Student entered</th><th>Match on roster</th><th>Scores</th><th></th></tr></thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.full_name}</b><br />{r.company}<br /><span className="sub">{r.email}</span></td>
                    <td style={{ minWidth: 240 }}>
                      <select value={pick[r.id] ?? ''} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value ? Number(e.target.value) : '' })}>
                        <option value="">— choose —</option>
                        {roster.map((x) => (
                          <option key={x.id} value={x.id} disabled={linked.has(x.id)}>
                            #{x.id} {x.full_name} — {x.company}{linked.has(x.id) ? ' (linked)' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>name {score(r.name_score)}<br />company {score(r.company_score)}</td>
                    <td>
                      <div className="row">
                        <button className="btn sm" disabled={busy === r.id} onClick={() => decide(r.id, true)}>Approve</button>
                        <button className="btn sm ghost" disabled={busy === r.id} onClick={() => decide(r.id, false)}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {err && <div className="err">{err}</div>}
      </div>

      <div className="card">
        <h3>Roster ({linked.size} / {roster.length} linked)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>#</th><th>Name</th><th>Company</th><th>Account</th></tr></thead>
            <tbody>
              {roster.map((x) => (
                <tr key={x.id}>
                  <td>{x.id}</td>
                  <td>{x.full_name}</td>
                  <td>{x.company}</td>
                  <td>{linked.get(x.id) ? <span className="pill ok">{linked.get(x.id)}</span> : <span className="pill">not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
