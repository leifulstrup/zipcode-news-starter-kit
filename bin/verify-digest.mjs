// The digest gate. Usage: node bin/verify-digest.mjs <digest.md> <delta.json>
//
// The one check that carries the whole design: every URL in the digest must
// exist in the delta file. The digest model is given ONLY the delta and no
// research tools, so a URL from anywhere else is a hallucinated or recycled
// item — exactly the padding a low-news day invites, and exactly what this
// gate exists to block. FATAL = exit 1, nothing is sent.
import { readFileSync } from 'node:fs';

const [digestPath, deltaPath] = process.argv.slice(2);
if (!digestPath || !deltaPath) {
  console.error('usage: node bin/verify-digest.mjs <digest.md> <delta.json>');
  process.exit(2);
}

let digest, delta;
try { digest = readFileSync(digestPath, 'utf8'); }
catch (err) { console.error(`verify-digest: cannot read ${digestPath}: ${err.message}`); process.exit(1); }
try { delta = JSON.parse(readFileSync(deltaPath, 'utf8')); }
catch (err) { console.error(`verify-digest: cannot read ${deltaPath}: ${err.message}`); process.exit(1); }

let fatal = 0, warn = 0;
const FATAL = msg => { console.error(`  FATAL  ${msg}`); fatal++; };
const WARN = msg => { console.log(`  warn   ${msg}`); warn++; };

console.log(`verify-digest ${digestPath}`);

// 1. Subject line first — this file becomes an email; without it the send step
//    would have to invent one.
if (!/^Subject: .+/m.test(digest.split('\n')[0] || ''))
  FATAL('first line must be "Subject: ..." — the digest is an email and the send step uses this line verbatim. See prompts/write-digest.md.');

// 2. URL subset check — the core anti-padding gate.
const allowed = new Set(delta.items.map(it => it.url).filter(Boolean));
const found = digest.match(/https?:\/\/[^\s)\]>"']+/g) || [];
for (const raw of new Set(found)) {
  const url = raw.replace(/[.,;:]+$/, '');
  if (!allowed.has(url))
    FATAL(`URL not in the delta file: ${url} — the digest may only report what daily-delta collected today. Remove the item; if it is real news, it will be in tomorrow's delta.`);
}

// 3. Disclosure footer — the digest is private, but it is still AI-written text
//    someone may forward; it must say what it is wherever it lands.
if (!/AI/.test(digest) || !/not reviewed by a human/i.test(digest))
  FATAL('missing the AI-generated / not-reviewed-by-a-human disclosure line — required even in a private email; see prompts/write-digest.md footer rules.');
if (!/not a mailing list/i.test(digest))
  FATAL('missing the "not a mailing list" footer phrase — the send-to-self boundary must be stated in the message itself.');

// 4. Size ceiling — the digest is a snapshot, not an issue. A long digest means
//    the model is writing an issue on a small model's budget, which is the
//    failure mode this product exists to avoid.
if (digest.length > 5000)
  FATAL(`digest is ${digest.length} chars (ceiling 5000). Cut it down — detail belongs in the weekly issue, the digest just points.`);

// Triage is allowed; note it, don't block it.
const mentioned = delta.items.filter(it => it.url && digest.includes(it.url)).length;
const linkable = delta.items.filter(it => it.url).length;
if (linkable > 0 && mentioned < linkable)
  WARN(`digest links ${mentioned} of ${linkable} delta items — triage is fine; confirm the drops were judgment, not oversight.`);

console.log(fatal ? `verify-digest: ${fatal} FATAL, ${warn} warning(s) — NOT SENDING` : `verify-digest passed with ${warn} warning(s)`);
process.exit(fatal ? 1 : 0);
