import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase/server';
import LivePlayer from './LivePlayer';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.isStudent) redirect('/');
  return <LivePlayer />;
}
