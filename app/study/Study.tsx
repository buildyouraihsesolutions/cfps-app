'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { LETTERS, type Domain, type PlanRow, type PoolRow } from '@/lib/types';

type By = 'domain' | 'chapter';
type StudyQ = {
  id: number; ref_code: string | null; stem: string; options: Record<string, string>;
  answer: string; explanation: string | null; fph_page: string | null;
  fph_section: number | null; fph_chapter: number | null; domain: string | null;
};

export default function Study({ domains, plan, pool, chapterNames, email, initSection, initChapter }: {
  domains: Domain[]; plan: PlanRow[]; pool: PoolRow[];
  chapterNames: { section: number; chapter: number; chapter_name: string | null }[];
  email: string; initSection?: number; initChapter?: number;
}) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [by, setBy] = useState<By>(initSection ? 'chapter' : 'domain');
  const [domain, setDomain] = useState(domains[0]?.code ?? 'I');
  const [chapterKey, setChapterKey] = useState(initSection ? `${initSection}-${initChapter ?? 'all'}` : '');
  const [shuffle, setShuffle] = useState(false);
  const [hideAnswer, setHideAnswer] = useState(false);

  const [qs, setQs] = useState<StudyQ[] | null>(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const domainPool = useMemo(() => {
    const m: Record<string, number> = {};
    pool.forEach((r) => { if (r.domain) m[r.domain] = (m[r.domain] ?? 0) + Number(r.n); });
    return m;
  }, [pool]);

  const chapters = useMemo(() => {
    const title = (s: number, c: number) =>
      plan.find((p) => p.section === s && p.chapter === c && !p.title.startsWith('Section'))?.title ??
      chapterNames.find((x) => x.section === s && x.chapter === c)?.chapter_name ?? `Chapter ${s}.${c}`;
    const bySec = new Map<number, { key: string; label: string; n: number }[]>();
    pool.forEach((r) => {
      if (r.fph_chapter == null) return;
      const arr = bySec.get(r.fph_section) ?? [];
      const ex = arr.find((a) => a.key === `${r.fph_section}-${r.fph_chapter}`);
      if (ex) ex.n += Number(r.n);
      else arr.push({ key: `${r.fph_section}-${r.fph_chapter}`, label: `${r.fph_section}.${r.fph_chapter} ${title(r.fph_section, r.fph_chapter)}`, n: Number(r.n) });
      bySec.set(r.fph_section, arr);
    });
    return [...bySec.entries()].sort((a, b) => a[0] - b[0]).map(([s, arr]) => ({
      section: s,
      total: arr.reduce((t, a) => t + a.n, 0),
      items: arr.sort((a, b) => Number(a.key.split('-')[1]) - Number(b.key.split('-')[1])),
    }));
  }, [pool, plan, chapterNames]);

  async function load() {
    setErr('');
    let args: Record<string, unknown>;
    if (by === 'domain') args = { p_domain: domain, p_shuffle: shuffle };
    else {
      if (!chapterKey) return setErr('Choose a section or chapter.');
      const [s, c] = chapterKey.split('-');
      args = { p_section: Number(s), p_chapter: c === 'all' ? null : Number(c), p_shuffle: shuffle };
    }
    setBusy(true);
    const { data, error } = await sb.rpc('cfps_study_questions', args);
    setBusy(false);
    if (error) return setErr(error.message);
    if (!data?.length) return setErr('No questions available for this selection.');
    setQs(data as StudyQ[]);
    setI(0);
    setRevealed(false);
  }

  const go = (n: number) => {
    if (!qs) return;
    setI((x) => Math.min(qs.length - 1, Math.max(0, x + n)));
    setRevealed(false);
  };

  useEffect(() => {
    if (!qs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === ' ') { e.preventDefault(); setRevealed(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- setup screen ----------
  if (!qs) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={by === 'domain' ? 'on' : ''} onClick={() => setBy('domain')}>By domain</button>
          <button className={by === 'chapter' ? 'on' : ''} onClick={() => setBy('chapter')}>By chapter</button>
        </div>

        {by === 'domain' ? (
          <>
            <label htmlFor="dom">Domain</label>
            <select id="dom" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {domains.map((d) => <option key={d.code} value={d.code}>{d.code}. {d.name} ({domainPool[d.code] ?? 0} questions)</option>)}
            </select>
          </>
        ) : (
          <>
            <label htmlFor="ch">Section or chapter</label>
            <select id="ch" value={chapterKey} onChange={(e) => setChapterKey(e.target.value)}>
              <option value="">— choose —</option>
              {chapters.map((s) => (
                <optgroup key={s.section} label={`FPH Section ${s.section}`}>
                  <option value={`${s.section}-all`}>Whole Section {s.section} ({s.total})</option>
                  {s.items.map((it) => <option key={it.key} value={it.key}>{it.label} ({it.n})</option>)}
                </optgroup>
              ))}
            </select>
          </>
        )}

        <label>Order</label>
        <div className="seg">
          <button className={!shuffle ? 'on' : ''} onClick={() => setShuffle(false)}>Book order (FPH page)</button>
          <button className={shuffle ? 'on' : ''} onClick={() => setShuffle(true)}>Shuffled</button>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 'normal' }}>
          <input type="checkbox" checked={hideAnswer} onChange={(e) => setHideAnswer(e.target.checked)} />
          Hide the answer until I tap “Show answer” (flashcard style)
        </label>

        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={load} disabled={busy}>{busy ? 'Loading…' : 'Start'}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    );
  }

  // ---------- viewer ----------
  const q = qs[i];
  const show = !hideAnswer || revealed;
  const ref = [q.fph_page && `FPH p. ${q.fph_page}`, q.domain && `Domain ${q.domain}`, q.ref_code].filter(Boolean).join(' · ');

  return (
    <div className="card" style={{ maxWidth: 820, position: 'relative', overflow: 'hidden', userSelect: 'none' }}>
      {/* light watermark */}
      {email && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.06, fontSize: 14,
          display: 'flex', flexWrap: 'wrap', alignContent: 'space-around', justifyContent: 'space-around',
          transform: 'rotate(-20deg) scale(1.4)', whiteSpace: 'nowrap',
        }}>
          {Array.from({ length: 24 }).map((_, k) => <span key={k} style={{ padding: '24px 30px' }}>{email}</span>)}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="pill">Question {i + 1} of {qs.length}</span>
        <button className="btn sm ghost" onClick={() => { setQs(null); setErr(''); }}>Change selection</button>
      </div>

      <div className="stem">{q.stem}</div>

      {LETTERS.map((L) => {
        const text = q.options?.[L];
        if (!text) return null;
        const correct = show && L === q.answer;
        return (
          <div key={L} className="opt" style={correct ? { borderColor: '#1e8e5a', background: 'rgba(30,142,90,.10)', fontWeight: 600 } : { cursor: 'default' }}>
            <span className="L">{L}.</span><span>{text}</span>{correct && <span style={{ marginLeft: 'auto' }}>✓</span>}
          </div>
        );
      })}

      {show ? (
        <div style={{ marginTop: 14 }}>
          <div><strong>Answer: {q.answer}</strong></div>
          {q.explanation && <p style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{q.explanation}</p>}
          {ref && <div className="sub" style={{ fontSize: 12 }}>{ref}</div>}
        </div>
      ) : (
        <button className="btn navy" style={{ marginTop: 14 }} onClick={() => setRevealed(true)}>Show answer</button>
      )}

      <div className="row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
        <button className="btn ghost" disabled={i === 0} onClick={() => go(-1)}>← Previous</button>
        <button className="btn navy" disabled={i === qs.length - 1} onClick={() => go(1)}>Next →</button>
      </div>

      <input
        type="range" min={0} max={qs.length - 1} value={i}
        onChange={(e) => { setI(Number(e.target.value)); setRevealed(false); }}
        style={{ width: '100%', marginTop: 14 }}
        aria-label="Jump to question"
      />
      <p className="sub" style={{ fontSize: 12, marginTop: 6 }}>Keys: ← → to move{hideAnswer ? ', Space to show the answer' : ''}.</p>
    </div>
  );
}
