'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Domain, PlanRow, PoolRow } from '@/lib/types';

type Mode = 'exam' | 'domain' | 'chapter';
type Source = 'all' | 'unmastered';
const fmt = (n: number) => { const m = Math.round(n * 1.8); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}` : `${m} min`; };

export default function Practice({ domains, plan, pool, chapterNames, initSection, initChapter }: {
  domains: Domain[]; plan: PlanRow[]; pool: PoolRow[];
  chapterNames: { section: number; chapter: number; chapter_name: string | null }[];
  initSection?: number; initChapter?: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initSection ? 'chapter' : 'exam');
  const [size, setSize] = useState(30);
  const [domain, setDomain] = useState(domains[0]?.code ?? 'I');
  const [chapterKey, setChapterKey] = useState(initSection ? `${initSection}-${initChapter ?? 'all'}` : '');
  const [dCount, setDCount] = useState<number | null>(10);
  const [timed, setTimed] = useState(false);
  const [source, setSource] = useState<Source>('all');
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

  async function start() {
    setBusy(true); setErr('');
    let args: Record<string, unknown>;
    if (mode === 'exam') args = { p_mode: 'exam', p_count: size, p_timed: true };
    else if (mode === 'domain') args = { p_mode: 'domain', p_count: dCount, p_domain: domain, p_timed: timed, p_source: source };
    else {
      if (!chapterKey) { setBusy(false); return setErr('Choose a section or chapter.'); }
      const [s, c] = chapterKey.split('-');
      args = { p_mode: 'chapter', p_count: dCount, p_section: Number(s), p_chapter: c === 'all' ? null : Number(c), p_timed: timed, p_source: source };
    }
    const { data, error } = await supabaseBrowser().rpc('cfps_start_attempt', args);
    if (error || !data) {
      setBusy(false);
      if (error?.message?.includes('NO_QUESTIONS_LEFT')) {
        return setErr('You have answered every question here correctly. Switch to "All questions" to practise them again.');
      }
      return setErr(error?.message ?? 'Could not start.');
    }
    router.push(`/attempt/${data}`);
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={mode === 'exam' ? 'on' : ''} onClick={() => setMode('exam')}>Exam simulation</button>
        <button className={mode === 'domain' ? 'on' : ''} onClick={() => setMode('domain')}>By domain</button>
        <button className={mode === 'chapter' ? 'on' : ''} onClick={() => setMode('chapter')}>By chapter</button>
      </div>

      {mode === 'exam' && (
        <>
          <p className="sub">Questions are drawn across all 8 domains in the same proportions as the real CFPS exam. Questions you have not seen yet come first.</p>
          <label>Number of questions</label>
          <div className="seg">
            {[30, 50, 70, 100].map((n) => (
              <button key={n} className={size === n ? 'on' : ''} onClick={() => setSize(n)}>{n} · {fmt(n)}</button>
            ))}
          </div>
          <table className="t" style={{ marginTop: 14 }}>
            <thead><tr><th>Domain</th><th>Weight</th><th>≈ Questions</th></tr></thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.code}><td>{d.code}. {d.name}</td><td>{d.weight}%</td><td>{Math.round((size * d.weight) / 100)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {mode === 'domain' && (
        <>
          <label htmlFor="dom">Domain</label>
          <select id="dom" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domains.map((d) => <option key={d.code} value={d.code}>{d.code}. {d.name} ({domainPool[d.code] ?? 0} questions)</option>)}
          </select>
        </>
      )}

      {mode === 'chapter' && (
        <>
          <label htmlFor="ch">Section or chapter</label>
          <select id="ch" value={chapterKey} onChange={(e) => setChapterKey(e.target.value)}>
            <option value="">— choose —</option>
            {chapters.map((s) => (
              <optgroup key={s.section} label={`FPH Section ${s.section}`}>
                <option value={`${s.section}-all`}>Whole Section {s.section} ({s.total})</option>
                {s.items.map((i) => <option key={i.key} value={i.key}>{i.label} ({i.n})</option>)}
              </optgroup>
            ))}
          </select>
        </>
      )}

      {mode !== 'exam' && (
        <>
          <label>Question source</label>
          <div className="seg">
            <button className={source === 'all' ? 'on' : ''} onClick={() => setSource('all')}>All questions (random)</button>
            <button className={source === 'unmastered' ? 'on' : ''} onClick={() => setSource('unmastered')}>Not yet answered correctly</button>
          </div>
          {source === 'unmastered' && (
            <p className="sub" style={{ marginTop: 6 }}>
              Only questions you have never answered correctly: new ones, ones you got wrong, and ones you skipped.
            </p>
          )}

          <label>Questions</label>
          <div className="seg">
            {[10, 20, null].map((n) => (
              <button key={String(n)} className={dCount === n ? 'on' : ''} onClick={() => setDCount(n)}>{n ?? 'All available'}</button>
            ))}
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 'normal' }}>
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Timed at exam pace (1.8 min / question)
          </label>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <button className="btn" onClick={start} disabled={busy}>{busy ? 'Preparing…' : 'Start'}</button>
      </div>
      {err && <div className="err">{err}</div>}
    </div>
  );
}
