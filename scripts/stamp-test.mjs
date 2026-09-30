// Local test: node scripts/stamp-test.mjs path/to/handout.pdf
// Stamps the file with a sample name and reports pages, time and size — same code the app uses.
import fs from 'node:fs';
import { stampPdf } from '../lib/stamp.mjs';

const input = process.argv[2];
if (!input) { console.error('Usage: node scripts/stamp-test.mjs path/to/handout.pdf'); process.exit(1); }
const src = fs.readFileSync(input);
const t0 = Date.now();
const { bytes, pages } = await stampPdf(src, { name: 'Test Student', email: 'test.student@example.com', userId: 'test' });
const ms = Date.now() - t0;
const out = input.replace(/\.pdf$/i, '') + '_STAMPED_TEST.pdf';
fs.writeFileSync(out, bytes);
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`Pages: ${pages}\nTime: ${(ms / 1000).toFixed(1)} s\nSize: ${mb(src.length)} → ${mb(bytes.length)}\nMemory peak (approx): ${mb(process.memoryUsage().rss)}\nSaved: ${out}`);
console.log(ms > 40000 ? '⚠ Over 40 s — tell Claude; the server limit is 60 s.' : '✓ Well within the server time limit.');
