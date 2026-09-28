import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { getContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'cfps-handouts';
const MASTER = 'master/CFPS_Handout_GroupD.pdf';

/** pdf-lib standard fonts only support WinAnsi — replace anything else. */
const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, '?');

export async function POST() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!ctx.isStudent) return NextResponse.json({ error: 'Your access has not been approved yet.' }, { status: 403 });

  const admin = supabaseAdmin();
  const version = process.env.HANDOUT_VERSION || '1';
  const folder = `stamped/v${version}`;
  const path = `${folder}/${ctx.userId}.pdf`;

  const { data: row } = await admin.from('cfps_allowed_emails').select('full_name').eq('email', ctx.email).maybeSingle();
  const name = row?.full_name || ctx.email.split('@')[0];
  const fileName = `CFPS_Handout_${name.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`;

  // 1) already stamped for this student?
  const { data: existing } = await admin.storage.from(BUCKET).list(folder, { search: `${ctx.userId}.pdf` });
  if (!existing?.some((f) => f.name === `${ctx.userId}.pdf`)) {
    // 2) stamp the master copy
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(MASTER);
    if (dlErr || !blob) return NextResponse.json({ error: 'Handout is not available yet. Please contact your instructor.' }, { status: 500 });

    const pdf = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const date = new Date().toISOString().slice(0, 10);
    const footer = safe(`Licensed to ${name} | ${ctx.email} | ${date} | Not for distribution`);
    const mark = safe(`${name} - ${ctx.email}`);

    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      // footer line
      const fs = Math.max(6, Math.min(8, width / 80));
      const fw = font.widthOfTextAtSize(footer, fs);
      page.drawRectangle({ x: (width - fw) / 2 - 4, y: 6, width: fw + 8, height: fs + 5, color: rgb(1, 1, 1), opacity: 0.85 });
      page.drawText(footer, { x: (width - fw) / 2, y: 9, size: fs, font, color: rgb(0.08, 0.06, 0.27) });
      // diagonal watermark
      const ws = Math.min(28, (Math.hypot(width, height) * 0.7) / Math.max(1, bold.widthOfTextAtSize(mark, 1)));
      const ww = bold.widthOfTextAtSize(mark, ws);
      const angle = Math.atan2(height, width);
      page.drawText(mark, {
        x: width / 2 - (ww / 2) * Math.cos(angle),
        y: height / 2 - (ww / 2) * Math.sin(angle),
        size: ws, font: bold, color: rgb(0.93, 0.27, 0.13), opacity: 0.1,
        rotate: degrees((angle * 180) / Math.PI),
      });
    }
    pdf.setSubject(safe(`Licensed to ${name} <${ctx.email}>`));
    pdf.setKeywords([ctx.email, ctx.userId, `stamped:${date}`]);

    const bytes = await pdf.save({ useObjectStreams: true });
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) return NextResponse.json({ error: 'Could not prepare your copy. Please try again.' }, { status: 500 });
  }

  // 3) short-lived download link
  const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(path, 300, { download: fileName });
  if (sErr || !signed) return NextResponse.json({ error: 'Could not create the download link.' }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl });
}
