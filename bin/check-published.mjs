#!/usr/bin/env node
/**
 * check-published.mjs — did the issue that should exist, exist?
 *
 *   node bin/check-published.mjs [--week YYYY-MM-DD] [--base https://...]
 *   node bin/check-published.mjs --print-expected-week
 *
 * WHY THIS EXISTS
 * Every other check assumes a run happened. The weekly workflow proves an issue
 * was BUILT; the smoke test proves the site is SERVING something. Neither can see
 * the failure mode with no artifacts at all: GitHub silently drops scheduled runs
 * during platform degradation and never retries them. Had that landed on a publish
 * evening there would be no issue, no failed run, no notification — the first
 * person to notice would be a reader. So this asks the one question nothing else
 * asks, the day AFTER the publication window, and needs no network for the part
 * that matters — the whole point is to still work when GitHub's own services are
 * what failed.
 *
 * --print-expected-week exists so the workflow can reuse THIS script's date
 * arithmetic instead of re-implementing it in shell. Two definitions of "the week
 * that should exist" will disagree on the day it matters.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, ROOT } from './lib/config.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i > -1 ? args[i + 1] : d; };

/* A truncated draft is much smaller than a merely short edition, and this check lives in
   the gap between them. It used to be a constant — 40000, under a comment telling the
   publisher to "raise it once you know your own typical size", which is a calibration step
   nobody performs and which goes stale the first time the format changes. The reference
   implementation shipped the same idea and it went wrong exactly that way: its floor was
   measured while the editor's addendum still lived inside the issue, the addendum moved to
   its own file, editions got legitimately shorter, and the floor ended up ABOVE two real
   published ones.

   That was a harmless false positive while this only opened an issue. It is not harmless
   now: since 0.27.0 the publication check REPAIRS what it finds, so a false positive
   downloads an artifact and tries to republish a week that was never broken — every
   weekend, for a publisher who is not watching. Adding an actuator to a detector raises the
   price of a miscalibrated threshold.

   So the expectation is measured from the editions this publication has actually produced,
   rather than from a number in a comment. A brand-new kit has nothing to measure and falls
   back to the absolute floor, which is the correct behaviour for issue number one. */
const FLOOR_BYTES  = 20000;   // below this it is truncated whatever the corpus says
const FAIL_RATIO   = 0.40;    // ... or under 40% of what this publication actually runs
const WARN_RATIO   = 0.60;    // shrinking: worth saying, not worth blocking on
const CORPUS_WEEKS = 6;       // recent enough to follow a format change, wide enough not to
                              // be swung by one quiet week
const STALE_FACTS_DAYS = 4;   // facts fetched long before the issue = reused data

/* Median of the most recent editions BEFORE this one. Median rather than mean, because one
   truncated draft already in the archive would drag a mean down and quietly lower the bar
   for the next one — a threshold that ratchets downwards is worse than a fixed one. */
function corpusMedian(excludeWeek) {
  let sizes = [];
  try {
    sizes = readdirSync(join(ROOT, 'issues'))
      .filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .filter(f => f.slice(0, 10) !== excludeWeek)
      .sort()
      .slice(-CORPUS_WEEKS)
      .map(f => statSync(join(ROOT, 'issues', f)).size);
  } catch { return null; }
  if (sizes.length < 3) return null;   // too few to calibrate against — use the floor alone
  const v = [...sizes].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

const config = loadConfig();

/* ---------- which week should exist? ----------
   Publication is config.publishDay. Computed as the most recent publish day
   STRICTLY BEFORE today (UTC): on publish day itself the run may not have
   happened yet, and a check that fails every publish-day morning would be
   trained away within a fortnight. */
const WEEKDAYS = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
function lastPublishDay(from = new Date()) {
  const target = WEEKDAYS[config.publishDay] ?? 5;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() !== target);
  return d.toISOString().slice(0, 10);
}

if (args.includes('--print-expected-week')) {
  console.log(lastPublishDay());
  process.exit(0);
}

const week = arg('--week') || lastPublishDay();
const base = arg('--base');

/* ---------- fresh clone? ----------
   A kit with no issues at all has nothing to have missed. Onboarding guidance,
   not an error — a red X on day one teaches people to ignore red X's. */
const issuesDir = join(ROOT, 'issues');
const issueDates = existsSync(issuesDir)
  ? readdirSync(issuesDir).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).map(f => f.slice(0, 10))
  : [];
if (issueDates.length === 0) {
  console.log('check-published: no issues exist yet — nothing to check.');
  console.log('This is a fresh kit. Publish your first issue (see /first-issue or docs/),');
  console.log(`and from then on this check expects one every ${config.publishDay}.`);
  process.exit(0);
}

/* ---------- has issues, but none from a scheduled run ----------
   The guard above distinguished "fresh kit" from "has issues". It did not
   distinguish "has issues, but none produced by the weekly cron" — which is the
   state /first-issue leaves EVERY instance in, because it says to date the
   calibration issue today, and today is publishDay one day in seven.

   In that state the check looked for an issue on the most recent publishDay,
   found none, and diagnosed a failed run: "the scheduled run never fired, or it
   fired and died before the commit step." Neither was true. The truth was
   "no scheduled run has happened yet", which needs no action at all — and the
   alarm arrives on day one, in the window where a new publisher is least able
   to tell a real alert from noise, about the alerting system that is the kit's
   whole safety net. The guard above states the principle it missed: a red X on
   day one teaches people to ignore red X's. (90706 field instance.) */
const targetDow = WEEKDAYS[config.publishDay] ?? 5;
const anyScheduled = issueDates.some(d => new Date(`${d}T12:00:00Z`).getUTCDay() === targetDow);
if (!anyScheduled) {
  console.log(`check-published: ${issueDates.length} issue(s) exist, but none is dated on a ${config.publishDay}.`);
  console.log('No scheduled run has published yet — a locally written issue is dated the day it was');
  console.log(`written. Nothing is wrong, and nothing is missing. From the first ${config.publishDay} the`);
  console.log('weekly workflow publishes, this check starts expecting one every week.');
  process.exit(0);
}

/* ---------- deliberate skips ----------
   A holiday is not a failure. Without this the check would file the same alarm
   every week until someone silenced it — and a silenced check is worse than no
   check. NEVER add a date here to quiet a real failure; fix the failure. */
const SKIP_FILE = join(ROOT, 'data', 'skipped-weeks.txt');
if (existsSync(SKIP_FILE)) {
  const skipped = readFileSync(SKIP_FILE, 'utf8')
    .split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
  if (skipped.includes(week)) {
    console.log(`${week} is listed in data/skipped-weeks.txt as a deliberate skip. Nothing to check.`);
    process.exit(0);
  }
}

const fatal = [], warn = [];
const need = (cond, msg) => { if (!cond) fatal.push(msg); };
const want = (cond, msg) => { if (!cond) warn.push(msg); };

console.log(`check-published ${week}`);

/* ---------- 1. the issue itself — the whole point ---------- */
const issuePath = join(ROOT, 'issues', `${week}.html`);
const hasIssue = existsSync(issuePath);

need(hasIssue,
  `NO ISSUE FOR ${week}. issues/${week}.html does not exist. Either the scheduled run never ` +
  `fired — GitHub drops scheduled runs during degradation and does not retry them — or it ` +
  `fired and died before the commit step. Check the Actions history for the publish window ` +
  `before assuming which; the two need opposite responses.`);

if (hasIssue) {
  const bytes = statSync(issuePath).size;
  const kb = n => `${(n / 1024).toFixed(1)} KB`;
  const median = corpusMedian(week);
  const failAt = median ? Math.max(FLOOR_BYTES, Math.round(median * FAIL_RATIO)) : FLOOR_BYTES;

  need(bytes >= failAt,
    `issues/${week}.html is only ${kb(bytes)}. ` +
    (median
      ? `Your last ${CORPUS_WEEKS} editions run ${kb(median)} at the median, and anything under ` +
        `${kb(failAt)} is a truncated draft rather than a short week. `
      : `Nothing under ${kb(failAt)} is a usable issue. `) +
    `Check the run's num_turns against --max-turns.`);

  // A warning, never a failure. A quiet week is allowed to be short, and this check must
  // never be the reason a real edition is reported missing.
  if (median) {
    want(bytes >= median * WARN_RATIO,
      `issues/${week}.html is ${kb(bytes)}, under ${Math.round(WARN_RATIO * 100)}% of your ` +
      `${kb(median)} median. Not a fault on its own, but worth reading before it becomes normal.`);
  }

  console.log(`  issue present: ${kb(bytes)}` +
    (median ? ` (median of last ${CORPUS_WEEKS}: ${kb(median)}, fails under ${kb(failAt)})` : ''));
}

/* ---------- 2. the artifacts either side of it ----------
   Warnings, not failures: each can break alone without the issue being wrong,
   and a reader can still read the issue without any of them. */
want(existsSync(join(ROOT, 'issues', `${week}.pdf`)),
  `No PDF at issues/${week}.pdf. The print-edition step failed while the HTML succeeded — usually Playwright or the Chromium install.`);

const factsPath = join(ROOT, 'data', 'facts', `${week}.json`);
if (existsSync(factsPath)) {
  try {
    const facts = JSON.parse(readFileSync(factsPath, 'utf8'));
    if (facts.queriedAt) {
      const ageDays = (new Date(`${week}T12:00:00Z`) - new Date(facts.queriedAt)) / 86400000;
      want(Math.abs(ageDays) <= STALE_FACTS_DAYS,
        `data/facts/${week}.json was queried ${ageDays.toFixed(1)} days from the issue date — ` +
        `figures may have been carried over rather than gathered for this issue.`);
    } else {
      warn.push(`data/facts/${week}.json has no queriedAt — it looks like a dry-run artifact; nothing was actually fetched.`);
    }
    if (facts.errors?.length) {
      warn.push(`${facts.errors.length} data quer${facts.errors.length === 1 ? 'y' : 'ies'} failed during the run: ` +
        facts.errors.map(e => e.source).join('; ') + ' — the issue must say these could not be sourced.');
    }
  } catch {
    warn.push(`data/facts/${week}.json is not valid JSON.`);
  }
} else {
  want(false, `No facts file at data/facts/${week}.json. The issue was written without fetched data, ` +
    `so every figure in it came from the model or from cited pages rather than from your standing sources.`);
}

want(existsSync(join(ROOT, 'addendum', `${week}.html`)),
  `No editor's addendum at addendum/${week}.html — the private review channel is missing for this issue.`);

/* ---------- 3. optional live check ----------
   The smoke test owns "is the site healthy". This asks only whether the deploy
   carried THIS week — a warning, because the host builds asynchronously and a
   check soon after the commit can simply be early. */
if (base && hasIssue) {
  const url = `${base.replace(/\/$/, '')}/${week}/`;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const body = r.ok ? await r.text() : '';
    want(r.ok && body.includes(week),
      `${url} did not serve a page mentioning ${week} (HTTP ${r.status}). The issue is committed ` +
      `but may not have deployed yet — re-check before acting.`);
    if (r.ok && body.includes(week)) console.log(`  live: ${url} serving`);
  } catch (e) {
    warn.push(`Could not reach ${url}: ${e.message}. Inconclusive, not a failure.`);
  }
}

/* ---------- report ---------- */
for (const w of warn) console.log(`::warning::${w}`);
for (const f of fatal) console.error(`::error::${f}`);

if (fatal.length) {
  console.error(`\nNOT PUBLISHED — ${fatal.length} problem(s) for ${week}.`);
  console.error('To catch up a missed week, dispatch the weekly workflow with that date:');
  console.error(`  gh workflow run weekly.yml -f week=${week}`);
  console.error('If the week was skipped on purpose, add it to data/skipped-weeks.txt instead of silencing this check.');
  process.exit(1);
}
console.log(`\n${week} published${warn.length ? ` with ${warn.length} warning(s)` : ''}`);
