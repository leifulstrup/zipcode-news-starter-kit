#!/usr/bin/env node
/**
 * source-retrospective.mjs — did the numbers we already printed stay true?
 *
 *   node bin/source-retrospective.mjs [--min-age-days 21] [--write]
 *
 * WHY THIS EXISTS
 * Every other quality mechanism in this kit is a judgement made at publication
 * time by the same model that wrote the thing being judged. The gates are the
 * model's, the rubric application is the model's, the addendum is the model's.
 * That is a real weakness, and no amount of care inside a single run fixes it.
 *
 * This is the one mechanism that does not depend on that judgement. It re-asks
 * the SAME questions of the SAME sources for windows already published — via each
 * adapter's retrospective() hook — and diffs the answers against what the facts
 * files recorded. Official feeds revise themselves (late reports,
 * reclassification, withdrawn records); the size of that revision is a FACT about
 * the source that can be measured rather than estimated, and it should govern how
 * confidently the paper phrases the numbers it leads with.
 *
 * HOW TO REPORT DRIFT
 * A difference between then and now is the COMBINED effect of late reporting,
 * reclassification, and unfounding — this method cannot separate them. Never
 * report drift as "the source changed its numbers"; report it as how much a
 * published figure moves after publication.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/config.mjs';
import { adapters } from './adapters/index.mjs';

const args = process.argv.slice(2);
const argv = k => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const WRITE = args.includes('--write');
const MIN_AGE = Number(argv('--min-age-days') || 21);

const withHook = adapters.filter(a => typeof a.retrospective === 'function');
if (!withHook.length) {
  console.log('source-retrospective: no adapter exposes retrospective() — nothing to re-check.');
  console.log('That is the expected state of a fresh kit. Add the hook to an adapter (see');
  console.log('bin/adapters/README.md §9) once you have published figures worth re-measuring.');
  process.exit(0);
}

/* ---------- load the editions old enough to have settled ---------- */
const FACTS = join(ROOT, 'data', 'facts');
if (!existsSync(FACTS)) { console.log('no data/facts directory — nothing to look back on yet'); process.exit(0); }

const today = new Date();
const editions = readdirSync(FACTS).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
  .map(f => ({ week: f.replace('.json', ''), file: join(FACTS, f) }))
  .filter(e => (today - new Date(`${e.week}T12:00:00Z`)) / 86400000 >= MIN_AGE)
  .map(e => {
    try { return { week: e.week, facts: JSON.parse(readFileSync(e.file, 'utf8')) }; }
    catch { console.log(`  ! ${e.week}: unreadable facts file, skipping`); return null; }
  })
  .filter(Boolean);

if (!editions.length) {
  console.log(`No edition is yet ${MIN_AGE} days old. Nothing to re-check — that is the expected`);
  console.log('answer early on, not a failure. Revision needs time to happen.');
  process.exit(0);
}

console.log(`Re-checking ${editions.length} edition(s) at least ${MIN_AGE} days old, via ${withHook.length} adapter(s).\n`);

/* ---------- run the hooks ---------- */
const allRows = [], errors = [];
for (const adapter of withHook) {
  try {
    const { rows = [], errors: errs = [] } = await adapter.retrospective({ editions }) ?? {};
    allRows.push(...rows);
    errors.push(...errs);
    console.log(`${adapter.name}: ${rows.length} figure(s) re-checked, ${errs.length} quer${errs.length === 1 ? 'y' : 'ies'} failed`);
  } catch (e) {
    errors.push({ source: adapter.name, url: '', message: `retrospective() threw: ${e.message}` });
    console.log(`${adapter.name}: retrospective() threw — ${e.message}`);
  }
}

for (const r of allRows) {
  const flag = r.delta === 0 ? '  ' : (Math.abs(r.delta) / Math.max(r.printed, 1) > 0.05 ? '!!' : ' *');
  console.log(`  ${flag} ${r.week}  ${String(r.key).padEnd(24)} printed ${String(r.printed).padStart(6)}  now ${String(r.now).padStart(6)}  ${r.delta >= 0 ? '+' : ''}${r.delta}`);
}

/* ---------- the ledger ---------- */
const moved = allRows.filter(r => r.delta !== 0);
// Any figure whose key suggests a death or serious violence gets shouted about —
// it is the single most consequential class of number the paper prints.
const graveMoved = moved.filter(r => /homicide|murder|fatal|death/i.test(r.key));
const summary = {
  ranAt: new Date().toISOString(),
  minAgeDays: MIN_AGE,
  editionsChecked: editions.length,
  figuresChecked: allRows.length,
  figuresMoved: moved.length,
  moveRate: allRows.length ? Math.round((moved.length / allRows.length) * 1000) / 10 : null,
  medianAbsDrift: (() => {
    if (!moved.length) return 0;
    const s = moved.map(r => Math.abs(r.delta)).sort((a, b) => a - b);
    return s[s.length >> 1];
  })(),
  rows: allRows,
  errors,
};

console.log('---');
console.log(`${summary.figuresMoved} of ${summary.figuresChecked} published figures have since moved`
  + (summary.moveRate === null ? '' : ` (${summary.moveRate}%)`));
if (summary.figuresMoved) {
  console.log(`median absolute drift on the figures that moved: ${summary.medianAbsDrift}`);
  console.log('This is the number that should govern how confidently the paper phrases these trends.');
} else if (allRows.length) {
  console.log('No published figure has moved. Encouraging — but one clean pass over a short');
  console.log('history is not evidence that the feed is stable. Keep measuring.');
}
if (graveMoved.length) {
  console.log('\n!! A death/serious-incident count has changed since publication. That is the');
  console.log('   most consequential figure in the paper. Read the detail above before the next issue.');
}

if (WRITE) {
  const dir = join(ROOT, 'data', 'retrospective');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, `${stamp}.json`), JSON.stringify(summary, null, 2));

  const md = [
    '', `## Retrospective ${stamp}`, '',
    `Re-queried ${summary.editionsChecked} edition(s), ${summary.figuresChecked} published figures.`,
    `**${summary.figuresMoved} had moved** (${summary.moveRate ?? 0}%), median absolute drift ${summary.medianAbsDrift}.`,
    '',
    'Drift is the combined effect of late reporting, reclassification and withdrawal. It cannot be',
    'attributed to one cause by this method, and should not be.',
    '',
    '| edition | figure | printed | now | delta |',
    '|---|---|---|---|---|',
    ...moved.map(r => `| ${r.week} | ${r.key} | ${r.printed} | ${r.now} | ${r.delta >= 0 ? '+' : ''}${r.delta} |`),
    ...(moved.length ? [] : ['| — | none moved | | | |']),
    '',
  ].join('\n');
  const led = join(ROOT, 'data', 'source-reliability.md');
  writeFileSync(led, (existsSync(led) ? readFileSync(led, 'utf8') : '# Source reliability ledger\n') + md);
  console.log(`\nwrote data/retrospective/${stamp}.json and appended to data/source-reliability.md`);
}

if (errors.length) {
  console.log(`\n${errors.length} quer${errors.length === 1 ? 'y' : 'ies'} failed; this pass is incomplete, not clean.`);
  for (const e of errors) console.log(`  - ${e.source}: ${e.message}`);
}
