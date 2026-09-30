// Handout stamping — shared by the app (API routes) and scripts/stamp-test.mjs.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

/** pdf-lib standard fonts only support WinAnsi — replace anything else. */
const safe = (s) => String(s).replace(/[^\x20-\x7E]/g, '?');

/**
 * Stamp every page with a footer (name | email | date) and a faint diagonal watermark.
 * @param {ArrayBuffer|Uint8Array} bytes  master PDF
 * @param {{name:string,email:string,userId?:string,date?:string}} who
 * @returns {Promise<{bytes:Uint8Array,pages:number}>}
 */
export async function stampPdf(bytes, who) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const date = who.date || new Date().toISOString().slice(0, 10);
  const footer = safe(`Licensed to ${who.name} | ${who.email} | ${date} | Not for distribution`);
  const mark = safe(`${who.name} - ${who.email}`);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fs = Math.max(6, Math.min(8, width / 80));
    const fw = font.widthOfTextAtSize(footer, fs);
    page.drawRectangle({ x: (width - fw) / 2 - 4, y: 6, width: fw + 8, height: fs + 5, color: rgb(1, 1, 1), opacity: 0.85 });
    page.drawText(footer, { x: (width - fw) / 2, y: 9, size: fs, font, color: rgb(0.08, 0.06, 0.27) });
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
  pdf.setSubject(safe(`Licensed to ${who.name} <${who.email}>`));
  pdf.setKeywords([who.email, who.userId || '', `stamped:${date}`]);
  const out = await pdf.save({ useObjectStreams: true });
  return { bytes: out, pages: pages.length };
}
