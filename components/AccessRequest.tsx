'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function AccessRequest({ existing }: { existing: { status: string; full_name: string; company: string } | null }) {
  const sb = supabaseBrowser();
  const [name, setName] = useState(existing?.full_name ?? '');
  const [companies, setCompanies] = useState<string[]>([]);
  const [company, setCompany] = useState(existing?.company ?? '');
  const [other, setOther] = useState('');

  useEffect(() => {
    sb.rpc('cfps_company_list').then(({ data }) => {
      const list = ((data ?? []) as { company: string }[]).map((r) => r.company);
      setCompanies(list);
      if (existing?.company && !list.includes(existing.company)) { setCompany('__other'); setOther(existing.company); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [status, setStatus] = useState(existing?.status ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const finalCompany = company === '__other' ? other.trim() : company;
    if (!finalCompany) { setBusy(false); return setErr('Please choose your company.'); }
    const { data, error } = await sb.rpc('cfps_request_access', { p_full_name: name, p_company: finalCompany });
    setBusy(false);
    if (error) return setErr(error.message);
    const s = Array.isArray(data) ? data[0]?.status : undefined;
    if (s === 'approved') return (window.location.href = '/');
    setStatus('pending');
  }

  if (status === 'pending') {
    return (
      <div className="card">
        <h2>Request received</h2>
        <p>Thank you, <b>{name}</b>. Your instructor will confirm your access shortly. Refresh this page later, or sign in again once approved.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2>Confirm your enrollment</h2>
      <p className="sub">Enter your full name in English and choose your company.</p>
      {status === 'rejected' && <div className="err">Your previous request could not be matched. Please check the details and try again.</div>}
      <form onSubmit={submit}>
        <label htmlFor="n">Full name (English)</label>
        <input id="n" type="text" required minLength={5} value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="c">Company</label>
        <select id="c" required value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">— choose your company —</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__other">Other (not listed)</option>
        </select>
        {company === '__other' && (
          <input type="text" required minLength={2} value={other} onChange={(e) => setOther(e.target.value)}
            placeholder="Type your company name" style={{ marginTop: 8 }} />
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Request access'}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  );
}
