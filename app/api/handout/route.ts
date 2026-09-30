import { NextResponse } from 'next/server';
import { getContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureStamped, signedLink } from '@/lib/handout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!ctx.isStudent) return NextResponse.json({ error: 'Your access has not been approved yet.' }, { status: 403 });

  const { data: row } = await supabaseAdmin().from('cfps_allowed_emails').select('full_name').eq('email', ctx.email).maybeSingle();
  const name = row?.full_name || ctx.email.split('@')[0];
  try {
    const { path } = await ensureStamped({ userId: ctx.userId, email: ctx.email, name });
    return NextResponse.json({ url: await signedLink(path, name) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Download failed' }, { status: 500 });
  }
}
