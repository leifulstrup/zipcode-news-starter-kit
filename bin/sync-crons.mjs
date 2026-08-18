// sync-crons — derive every workflow schedule from site.config.json.
//
//   node bin/sync-crons.mjs [--check]
//
// Why this exists, in one sentence: modular arithmetic on weekday indices is
// not a task to leave to a human (or an agent) at 4pm on a Friday.
//
// The scar: /setup used to name only weekly.yml, while the instruction to move
// the other two schedules lived as a COMMENT inside files nobody had reason to
// open. And the arithmetic bites hardest on the kit's own recommended cadence —
// a late-afternoon Pacific publish is 23:00 UTC, so the smoke test that must run
// "one hour later" belongs on the NEXT UTC DAY. Bumping only the hour digit
// yields a smoke test 23 hours BEFORE the publish it exists to verify, which
// then passes every week against last week's site and reports green forever.
// A passing watchdog is the silence this system is designed to produce, so
// nothing ever alerts. Every US Pacific publisher following the kit's own
// advice lands in that band. (Found by the 90706 field instance.)
//
// Derived schedules, all from `cronUtc` (the weekly publish):
//   weekly.yml            cronUtc exactly
//   smoke.yml             publish + 1h (rolls the weekday), plus a daily 13:00 sweep
//   publication-check.yml publish day + 1 and + 2, at 14:00 UTC
//   daily.yml             daily.hourUtc (independent; only checked, not derived)
//   sources.yml           fixed weekly/monthly cadence; not derived
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadConfig, loadDaily } from './lib/config.mjs';

const cfg = loadConfig();
const daily = loadDaily(cfg);
const checkOnly = process.argv.includes('--check');

const m = String(cfg.cronUtc).trim().match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+([0-6])$/);
if (!m) {
  console.error(`sync-crons: site.config.json cronUtc must look like "M H * * D" (D = 0-6, Sunday=0).`);
  console.error(`sync-crons: got "${cfg.cronUtc}". /setup writes this from your publish day and timezone.`);
  process.exit(2);
}
const [, minute, hour, dow] = m;
const H = Number(hour), D = Number(dow);

// +1 hour, rolling the weekday when it crosses midnight UTC. This is the whole
// point of the script.
const smokeH = (H + 1) % 24;
const smokeD = (H + 1) >= 24 ? (D + 1) % 7 : D;

const expected = {
  'weekly.yml': [`${minute} ${H} * * ${D}`],
  'smoke.yml': [`${minute} ${smokeH} * * ${smokeD}`, '0 13 * * *'],
  'publication-check.yml': [`0 14 * * ${(D + 1) % 7}`, `0 14 * * ${(D + 2) % 7}`],
  'daily.yml': [`0 ${daily.hourUtc} * * *`],
};

let changed = 0, mismatched = 0;
for (const [file, crons] of Object.entries(expected)) {
  const path = join(ROOT, '.github', 'workflows', file);
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { continue; }   // daily.yml may be absent

  // Replace the Nth cron line in schedule order, preserving each line's comment.
  let i = 0;
  const updated = text.replace(/^(\s*- cron: ')([^']*)(')/gm, (whole, pre, current, post) => {
    const want = crons[i++];
    if (want === undefined || current === want) return whole;
    changed++;
    return `${pre}${want}${post}`;
  });

  if (updated !== text) {
    mismatched++;
    if (checkOnly) {
      console.error(`::error::${file} schedule does not match site.config.json. Run: node bin/sync-crons.mjs`);
    } else {
      writeFileSync(path, updated);
      console.log(`updated ${file} -> ${crons.filter(Boolean).join(' | ')}`);
    }
  } else {
    console.log(`${checkOnly ? 'ok' : 'unchanged'} ${file} (${crons.join(' | ')})`);
  }
}

const publishUtc = `${String(H).padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
const smokeUtc = `${String(smokeH).padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
console.log(`\npublish ${publishUtc} day ${D} · smoke ${smokeUtc} day ${smokeD}` +
  (smokeD !== D ? '  <- smoke crosses into the next UTC day, as it must' : ''));
console.log('GitHub cron is UTC and ignores daylight saving; local publish time shifts by an hour twice a year.');

if (checkOnly && mismatched) process.exit(1);
if (!checkOnly && !changed) console.log('all schedules already agree with site.config.json');
