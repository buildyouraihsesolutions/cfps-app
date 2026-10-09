import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import AccessRequest from '@/components/AccessRequest';
import type { Attempt } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  const sb = supabaseServer();

  if (!ctx.isStudent) {
    const { data } = await sb.from('cfps_access_requests').select('status, full_name, company').eq('user_id', ctx.userId).maybeSingle();
    return (
      <>
        <div className="hero"><h1>Almost there</h1><p>Your account needs to be linked to the course roster.</p></div>
        <AccessRequest existing={data} />
      </>
    );
  }

  const [{ data: me }, { data: attempts }] = await Promise.all([
    sb.from('cfps_allowed_emails').select('full_name').eq('email', ctx.email).maybeSingle(),
    sb.from('cfps_attempts').select('*').not('submitted_at', 'is', null).order('started_at', { ascending: false }).limit(5),
  ]);
  const list = (attempts ?? []) as Attempt[];
  const exams = list.filter((a) => a.mode === 'exam');
  const last = exams[0];

  return (
    <>
      <div className="hero">
        <h1>Welcome{me?.full_name ? `, ${me.full_name.split(' ')[0]}` : ''}</h1>
        <p>Follow the study plan, keep the handout next to your FPH, and practise under real exam timing: 100 questions in 3 hours.</p>
      </div>
      <div className="grid">
        <div className="card" style={{ gridColumn: "1 / -1", order: 99, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 auto", width: "min(100%, 360px)" }}>
            <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden" }}>
              <iframe
                src="https://www.youtube-nocookie.com/embed/ppihVHPm18U"
                title="How to apply for the CFPS exam"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <h3 style={{ marginTop: 0 }}>🎬 How to apply for the CFPS exam</h3>
            <p className="sub" style={{ margin: 0 }}>Step-by-step walkthrough of the NFPA CFPS application, and the one mistake to avoid.</p>
          </div>
        </div>
        <Link className="card tile" href="/study-plan"><div className="ico">🗺️</div><h3>Study plan</h3><p className="sub">Blueprint domains, chapters and priorities. Tick off chapters as you finish them.</p></Link>
        <Link className="card tile" href="/handout"><div className="ico">📘</div><h3>Course handout</h3><p className="sub">Download your personal copy of the handout.</p></Link>
        <Link className="card tile" href="/practice"><div className="ico">📝</div><h3>Practice</h3><p className="sub">Exam simulation (30–100 Qs), by domain, or by chapter.</p></Link>
        <Link className="card tile" href="/study"><div className="ico">📖</div><h3>Study questions</h3><p className="sub">Browse questions with model answers and explanations.</p></Link>
        <Link className="card tile" href="/live"><div className="ico">🎯</div><h3>Live class</h3><p className="sub">Join the in-class challenge: find it in the FPH and quick quizzes.</p></Link>
        <Link className="card tile" href="/history"><div className="ico">📊</div><h3>My results</h3>
          <p className="sub">{last ? `Last exam: ${Math.round(((last.score ?? 0) / last.question_count) * 100)}% on ${last.question_count} questions` : 'No exams yet — start with 30 questions.'}</p></Link>
      </div>
    </>
  );
}
