#!/usr/bin/env node
/**
 * Privacy gate.
 *
 *   node bin/privacy-scan.mjs <file> [file...]
 *
 * Exits non-zero if a file contains anything that could identify the publisher's
 * home or any individual reader. This runs in CI before anything is committed,
 * because the failure mode it guards against is irreversible: once an address is
 * pushed to a public site and indexed, taking it down does not take it back.
 *
 * The coordinate patterns are not paranoia. In the reference implementation this
 * kit descends from, a lat/lon within ~100 m of a residence sat in a data file
 * through two text-based scrubs, because those greps looked for names and a house
 * number and a coordinate is neither. A coordinate is an address that hides from
 * a name-based search.
 *
 * Local patterns (the publisher's name, street, email) live in config/privacy.json
 * — filled in by /setup, extended every time something scary nearly ships. The
 * checks below that take no configuration are on for everyone, always.
 *
 * Self-match honesty: this file and config/privacy.json legitimately CONTAIN the
 * patterns, so scanning them would always fail. They are on an explicit exclude
 * list (announced when skipped) rather than relying on every caller to remember.
 */
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { ROOT, loadConfig, loadPrivacy } from './lib/config.mjs';

const cfg = loadConfig();
const priv = loadPrivacy();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Files that must contain the patterns in order to define or test them.
const EXCLUDE = [
  resolve(ROOT, 'bin', 'privacy-scan.mjs'),
  resolve(ROOT, 'config', 'privacy.json'),
];

const PATTERNS = [];

/* ---------- built-in checks, on for every publication ---------- */

// A decimal-degree pair is a US street address wearing a disguise.
PATTERNS.push({
  re: /\b\d{2}\.\d{4,}\s*,\s*-\d{2,3}\.\d{4,}\b/,
  what: 'latitude/longitude pair — a coordinate is an address that hides from a name-based search',
});

// Sub-ZIP geography fields: anything that centers on a point or a radius is finer
// than the finest geography this publication uses.
PATTERNS.push({
  re: /monitorPoint|radiusMeters/i,
  what: 'sub-ZIP geography field (a point or radius is finer than a ZIP)',
});

// Second-person framing that implies one household.
PATTERNS.push({
  re: /\byour (?:home|house|block|street|door)\b/i,
  what: 'second-person framing that implies one household — write for the neighborhood, not a reader’s address',
});

/* ---------- config-driven checks (filled in by /setup) ---------- */

for (const name of priv.publisherNames) {
  PATTERNS.push({ re: new RegExp(`\\b${esc(name)}\\b`, 'i'), what: `publisher name ("${name}")` });
}

for (const marker of priv.streetMarkers) {
  PATTERNS.push({
    re: new RegExp(`\\b${esc(marker)}\\b`, 'i'),
    what: `street/house marker ("${marker}") — previously usable as a home marker`,
  });
}

// Coordinate prefixes tighten the generic pair check to bare lats/lons near home:
// { "lat": "38.9", "lon": "-77.0" } catches "38.9xxxx" even without its pair.
for (const c of priv.coordinatePrefixes) {
  if (c.lat) PATTERNS.push({ re: new RegExp(`\\b${esc(c.lat)}\\d{2,}`), what: 'latitude near a configured location' });
  if (c.lon) PATTERNS.push({ re: new RegExp(`${esc(c.lon)}\\d{2,}`), what: 'longitude near a configured location' });
}

for (const email of priv.blockedEmails) {
  PATTERNS.push({ re: new RegExp(esc(email), 'i'), what: `blocked email address ("${email}")` });
}

// Personal-provider addresses: allowed only if explicitly listed (the publication's
// own contact address is allowed automatically).
const allowed = [...priv.allowedEmails, cfg.contactEmail].filter(Boolean).map(e => e.toLowerCase());
PATTERNS.push({
  re: /[\w.+-]+@(?:gmail|yahoo|hotmail|icloud|outlook|aol)\.com/i,
  what: 'a personal email address',
  allow: line => {
    const found = line.match(/[\w.+-]+@(?:gmail|yahoo|hotmail|icloud|outlook|aol)\.com/gi) || [];
    return found.every(e => allowed.includes(e.toLowerCase()));
  },
});

for (const p of priv.extraPatterns) {
  if (!p.pattern) continue;
  PATTERNS.push({ re: new RegExp(p.pattern, p.flags ?? 'i'), what: p.why || `configured pattern (${p.pattern})` });
}

/* ---------- scan ---------- */

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: privacy-scan.mjs <file> [file...]'); process.exit(2); }

let hits = 0, scanned = 0;
for (const f of files) {
  if (EXCLUDE.includes(resolve(f))) {
    console.log(`skipped (defines the patterns, would always match): ${f}`);
    continue;
  }
  let text;
  try { text = readFileSync(f, 'utf8'); }
  catch (e) { console.error(`cannot read ${f}: ${e.message}`); process.exit(2); }
  scanned++;

  const lines = text.split('\n');
  for (const p of PATTERNS) {
    lines.forEach((line, i) => {
      if (!p.re.test(line)) return;
      if (p.allow && p.allow(line)) return;
      hits++;
      console.error(`::error file=${f},line=${i + 1}::${p.what} — ${line.trim().slice(0, 140)}`);
    });
  }
}

if (hits) {
  console.error(`\nPRIVACY SCAN FAILED — ${hits} match(es). Nothing will be published.`);
  console.error(`If a match is a false positive, add an allow rule to config/privacy.json and say why.`);
  process.exit(1);
}
console.log(`privacy scan clean (${scanned} file(s) scanned, ${PATTERNS.length} patterns)`);
if (!priv.publisherNames.length && !priv.streetMarkers.length) {
  console.log(`note: config/privacy.json has no publisher identity yet — run /setup so this gate knows your name, street, and email.`);
}
