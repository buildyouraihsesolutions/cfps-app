import { redirect } from 'next/navigation';
import { getContext, supabaseServer } from '@/lib/supabase/server';
import MockLobby from './MockLobby';
import type { MockStatus } from '@/lib/mock';

export const dynamic = 'force-dynamic';

export default async function MockPage({ searchParams }: { searchParams: { done?: string } }) {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');

  const { data, error } = await supabaseServer().rpc('cfps_mock_status');
  if (error) return <div className="card" style={{ marginTop: 20 }}><div className="err">{error.message}</div></div>;
  if (!data) {
    return (
      <>
        <div className="hero"><h1>Mock exam</h1><p>No mock exam is scheduled at the moment.</p></div>
      </>
    );
  }
  return <MockLobby status={data as MockStatus} justSubmitted={searchParams?.done === '1'} />;
}
