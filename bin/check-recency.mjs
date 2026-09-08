#!/usr/bin/env node
/**
 * check-recency — how much of this issue a subscriber already read last week.
 *
 *   node bin/check-recency.mjs --week YYYY-MM-DD      measure one issue
 *   node bin/check-recency.mjs --file <issue.html>    measure an arbitrary file
 *   node bin/check-recency.mjs --calibrate            report your own distribution
 *
 * WHY THIS EXISTS, AND WHY NO OTHER GATE CAN DO IT
 *
 * Every other check in this kit asks whether an issue is internally sound: sourced,
 * geographed, disclosed, corroborated. An issue can pass all of them and be a verbatim
 * reprint of last week's — every claim still true, every source still real, and nothing
 * in it new. For a WEEKLY that is the defining failure mode, and it is invisible per
 * issue: you can only see it by comparing two.
 *
 * The reference instance measured its own six editions and found verbatim reprint
 * running 4.1 -> 18.0 -> 30.8 -> 26.2 -> 31.7 percent while every gate stayed green.
 * Two of every five sentences in its current issue had been published before. A
 * subscriber reading four weeks running had read the same paragraphs four times.
 *
 * THRESHOLDS ARE NOT SHIPPED, AND THAT IS THE POINT
 *
 * The instance's numbers are calibrated to one ZIP with a specific history, a specific
 * section list, and specific feeds. Copying them here would hand every publisher a
 * number with no provenance that they would reasonably treat as though it had one.
 *
 * So: this measures from the first issue and ENFORCES NOTHING until the publisher has
 * recorded a reading from their own archive (`--calibrate` writes
 * data/recency-calibration.json). An unenforced measurement that prints every week is
 * more honest than a borrowed threshold, and it is the only way to get a threshold that
 * means anything.
 *
 * Treat the recorded numbers as a RATCHET, not a target: tighten as issues land under
 * them, and keep the reading that justified each step. It is the one measure that gets
 * harder to satisfy as the archive grows, which is exactly why it has to be mechanical.
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ROOT } from './lib/config.mjs';

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const CALIBRATE = args.includes('--calibrate');
const CAL_PATH = join(ROOT, 'data', 'recency-calibration.json');

/* ---------- the measurement ---------- */

// News prose only. The disclosure bar, the per-section source apparatus and the
// standing About text repeat by DESIGN — counting them would measure the template
// rather than the reporting, and would report a high score for a well-behaved issue.
function newsSentences(html) {
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<div class="srcs"[\s\S]*?<\/div>/gi, ' ')      // per-section sources
    .replace(/<[^>]*class="aibar"[^>]*>[\s\S]*?<\/[^>]+>/gi, ' ')  // the AI disclosure
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');

  return s.split(/(?<=[.!?])\s+/)
    .map(x => x.trim())
    // Eight words or more: shorter fragments are headings, labels and dates, which
    // repeat harmlessly and would swamp the signal.
    .filter(x => x.split(/\s+/).length >= 8)
    .map(x => x.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function overlap(current, previous) {
  const prior = new Set(previous);
  const repeated = current.filter(x => prior.has(x));
  return {
    sentences: current.length,
    repeated: repeated.length,
    pct: current.length ? +(repeated.length * 100 / current.length).toFixed(1) : 0,
    examples: repeated.slice(0, 3),
  };
}

/* ---------- locating issues ---------- */

const issuesDir = join(ROOT, 'issues');
const allIssues = existsSync(issuesDir)
  ? readdirSync(issuesDir).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort()
  : [];

function previousOf(week) {
  const idx = allIssues.indexOf(`${week}.html`);
  if (idx > 0) return allIssues[idx - 1];
  return allIssues.filter(f => f < `${week}.html`).pop() ?? null;
}

/* ---------- calibrate ---------- */

if (CALIBRATE) {
  if (allIssues.length < 3) {
    console.log(`check-recency --calibrate: ${allIssues.length} published issue(s) in issues/.`);
    console.log('Need at least 3 to describe a distribution. Publish a few more, then run this again.');
    console.log('Until then the measurement still prints every week and enforces nothing, which is correct.');
    process.exit(0);
  }
  const readings = [];
  for (let i = 1; i < allIssues.length; i++) {
    const cur = newsSentences(readFileSync(join(issuesDir, allIssues[i]), 'utf8'));
    const prv = newsSentences(readFileSync(join(issuesDir, allIssues[i - 1]), 'utf8'));
    const o = overlap(cur, prv);
    readings.push({ week: allIssues[i].replace('.html', ''), pct: o.pct, sentences: o.sentences });
  }
  const pcts = readings.map(r => r.pct).sort((a, b) => a - b);
  const median = pcts[Math.floor(pcts.length / 2)];
  const worst = pcts[pcts.length - 1];

  console.log('\ncheck-recency --calibrate\n');
  for (const r of readings) console.log(`  ${r.week}   ${String(r.pct).padStart(5)}%   (${r.sentences} news sentences)`);
  console.log(`\n  median ${median}%   worst ${worst}%`);
  console.log('\nProposed starting thresholds, derived from YOUR issues — not from anyone else\'s:');
  const warn = Math.max(5, Math.round(median));
  const fail = Math.max(warn + 5, Math.round(worst));
  console.log(`  warn ${warn}%   fail ${fail}%`);
  console.log('\nThese are a CEILING to ratchet down, not a target to sit at. Set them where your');
  console.log('better weeks already land, so a bad week is what trips them.\n');

  writeFileSync(CAL_PATH, JSON.stringify({
    calibratedOn: new Date().toISOString().slice(0, 10),
    calibratedFrom: readings,
    warnAbovePct: warn,
    failAbovePct: fail,
    note: 'Derived from this instance\'s own archive by bin/check-recency.mjs --calibrate. ' +
          'A ratchet, not a target: tighten as issues land under it and keep the reading that justified each step. ' +
          'Never copy these to another instance — they describe this ZIP\'s history and nothing else.',
  }, null, 2) + '\n');
  console.log(`Wrote ${CAL_PATH.replace(ROOT + '/', '')}. Enforcement is now on.\n`);
  process.exit(0);
}

/* ---------- measure one issue ---------- */

const week = arg('--week');
const file = arg('--file');
if (!week && !file) {
  console.error('usage: check-recency.mjs --week YYYY-MM-DD | --file <issue.html> | --calibrate');
  process.exit(2);
}

const curPath = file ?? join(issuesDir, `${week}.html`);
if (!existsSync(curPath)) { console.error(`::error::${curPath} not found`); process.exit(1); }

const prevArg = arg('--previous');
const prevName = prevArg ?? (week ? previousOf(week) : null);
const prevPath = prevArg ?? (prevName ? join(issuesDir, prevName) : null);

if (!prevPath || !existsSync(prevPath)) {
  console.log(`check-recency ${basename(curPath)}: no previous edition to compare against.`);
  console.log('  The first issue has nothing to repeat. Nothing to check.');
  process.exit(0);
}

const o = overlap(
  newsSentences(readFileSync(curPath, 'utf8')),
  newsSentences(readFileSync(prevPath, 'utf8')));

const cal = existsSync(CAL_PATH) ? JSON.parse(readFileSync(CAL_PATH, 'utf8')) : null;

console.log(`check-recency ${basename(curPath)} vs ${basename(prevPath)}`);
console.log(`  ${o.repeated} of ${o.sentences} news sentences already published — ${o.pct}%`);
for (const ex of o.examples) console.log(`    repeated: "${ex.slice(0, 90)}${ex.length > 90 ? '…' : ''}"`);

if (!cal) {
  console.log('\n  MEASURED, NOT ENFORCED. data/recency-calibration.json does not exist, so there are');
  console.log('  no thresholds — and this kit ships none, because a threshold copied from another');
  console.log('  publication is a number with no provenance. Run:');
  console.log('\n      node bin/check-recency.mjs --calibrate\n');
  console.log('  once you have three or more issues, and it will derive thresholds from your own archive.');
  process.exit(0);
}

if (o.pct > cal.failAbovePct) {
  console.error(`::error::${o.pct}% of this issue was already published last week, above your recorded ` +
    `fail threshold of ${cal.failAbovePct}% (calibrated ${cal.calibratedOn}). A subscriber is reading ` +
    `the same paragraphs again. Lead each item with what CHANGED since the last issue; a standing fact ` +
    `may appear as one status line and may not be re-argued or re-headlined.`);
  process.exit(1);
}
if (o.pct > cal.warnAbovePct) {
  console.log(`::warning::${o.pct}% already published last week, above your warn threshold of ` +
    `${cal.warnAbovePct}%. Not blocking. Worth reading the repeated sentences above and asking whether ` +
    `each one earns its place a second time.`);
}
console.log(`\nrecency ok — ${o.pct}% against warn ${cal.warnAbovePct}% / fail ${cal.failAbovePct}%`);
