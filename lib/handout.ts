import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
// @ts-expect-error — plain ESM module shared with scripts/stamp-test.mjs
import { stampPdf } from '@/lib/stamp.mjs';

export const BUCKET = 'cfps-handouts';
export const MASTER = 'master/CFPS_Handout_GroupD.pdf';

export const version = () => process.env.HANDOUT_VERSION || '1';
export const folder = () => `stamped/v${version()}`;
export const pathFor = (userId: string) => `${folder()}/${userId}.pdf`;

/** Names of stamped files that already exist for the current handout version. */
export async function stampedSet(): Promise<Set<string>> {
  const { data } = await supabaseAdmin().storage.from(BUCKET).list(folder(), { limit: 1000 });
  return new Set((data ?? []).map((f) => f.name));
}

/** Make sure this student's stamped copy exists; returns its storage path. */
export async function ensureStamped(who: { userId: string; email: string; name: string }, force = false) {
  const admin = supabaseAdmin();
  const path = pathFor(who.userId);
  if (!force) {
    const { data } = await admin.storage.from(BUCKET).list(folder(), { search: `${who.userId}.pdf` });
    if (data?.some((f) => f.name === `${who.userId}.pdf`)) return { path, created: false };
  }
  const { data: blob, error } = await admin.storage.from(BUCKET).download(MASTER);
  if (error || !blob) throw new Error('Handout is not available yet. Please contact your instructor.');
  const { bytes } = await stampPdf(await blob.arrayBuffer(), who);
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error('Could not prepare the stamped copy.');
  return { path, created: true };
}

export async function signedLink(path: string, name: string) {
  const fileName = `CFPS_Handout_${name.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 300, { download: fileName });
  if (error || !data) throw new Error('Could not create the download link.');
  return data.signedUrl;
}
