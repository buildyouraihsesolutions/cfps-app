import { NextResponse } from 'next/server';
import { getContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureStamped, stampedSet } from '@/lib/handout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Approved students with their account id (auth users are matched by email). */
async function approvedStudents() {
  const admin = supabaseAdmin();
  const { data: allowed } = await admin.from('cfps_allowed_emails').select('email, full_name, roster_id').is('revoked_at', null);
  const ids = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    (data?.users ?? []).forEach((u) => u.email && ids.set(u.email.toLowerCase(), u.id));
    if (!data || data.users.length < 1000) break;
  }
  return (allowed ?? [])
    .map((a) => ({ email: a.email as string, name: a.full_name as string, roster: a.roster_id as number | null, userId: ids.get(String(a.email).toLowerCase()) ?? null }))
    .sort((a, b) => (a.roster ?? 999) - (b.roster ?? 999));
}

export async function GET() {
  const ctx = await getContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const [list, done] = await Promise.all([approvedStudents(), stampedSet()]);
  return NextResponse.json({
    version: process.env.HANDOUT_VERSION || '1',
    students: list.map((s) => ({ ...s, ready: !!s.userId && done.has(`${s.userId}.pdf`) })),
  });
}

/** Prepare one student's copy (the admin page calls this one student at a time). */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const { userId, force } = (await req.json()) as { userId?: string; force?: boolean };
  const s = (await approvedStudents()).find((x) => x.userId === userId);
  if (!s || !s.userId) return NextResponse.json({ error: 'Student not found or has no account yet' }, { status: 404 });
  const t0 = Date.now();
  try {
    const r = await ensureStamped({ userId: s.userId, email: s.email, name: s.name }, !!force);
    return NextResponse.json({ ok: true, created: r.created, ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
