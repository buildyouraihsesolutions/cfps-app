import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase/server';
import HandoutButton from './HandoutButton';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  return (
    <>
      <h1 className="page">Course handout</h1>
      <p className="sub">Your copy is personalised: every page carries your name and email. Please keep it for your own study only.</p>
      <div className="card" style={{ maxWidth: 620 }}>
        <h3>CFPS Preparation Course — Handout</h3>
        <p className="sub">The first download may take up to a minute while your personal copy is prepared. Later downloads are instant.</p>
        <HandoutButton />
      </div>
    </>
  );
}
