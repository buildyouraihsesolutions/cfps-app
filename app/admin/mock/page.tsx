import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import AdminTabs from '@/components/AdminTabs';
import MockResults from './MockResults';
import type { MockExam, MockResult } from '@/lib/mock';

export const dynamic = 'force-dynamic';

export default async function AdminMockPage({ searchParams }: { searchParams: { exam?: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  const sb = supabaseServer();

  const { data: exams, error: eErr } = await sb.from('cfps_mock_exams').select('*').order('opens_at', { ascending: false });
  if (eErr) return <div className="card" style={{ marginTop: 20 }}><div className="err">{eErr.message}</div></div>;
  const list = (exams ?? []) as MockExam[];
  if (!list.length) {
    return (<><AdminTabs active="mock" /><div className="card"><p className="sub">No mock exam has been created yet.</p></div></>);
  }
  const exam = list.find((e) => String(e.id) === searchParams?.exam) ?? list[0];

  const [{ data: rows, error }, { data: domains }] = await Promise.all([
    sb.rpc('cfps_mock_results', { p_exam: exam.id }),
    sb.from('cfps_domains').select('code, name').order('sort'),
  ]);
  if (error) {
    return (<><AdminTabs active="mock" /><div className="card"><div className="err">{error.message}</div></div></>);
  }

  return (
    <>
      <AdminTabs active="mock" />
      <MockResults
        exams={list}
        exam={exam}
        rows={(rows ?? []) as MockResult[]}
        domains={(domains ?? []) as { code: string; name: string }[]}
      />
    </>
  );
}
