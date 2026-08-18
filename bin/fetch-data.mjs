#!/usr/bin/env node
/**
 * fetch-data.mjs — deterministic weekly data fetch.
 *
 *   node bin/fetch-data.mjs [--week YYYY-MM-DD] [--out data/facts] [--dry-run]
 *
 * WHY THIS EXISTS
 * Every number that has to be RIGHT is fetched by a script, never asked of the
 * writing model. The reference publication shipped (or nearly shipped) three
 * separate bugs when an agent did its own fetching: records read oldest-first and
 * presented as this week's, a percentage quoted with no prior-year denominator,
 * and intermittent 403s silently becoming "no data". None of that is a judgement
 * problem, so none of it belongs to the model. This script runs every adapter in
 * bin/adapters/index.mjs, assembles their blocks into one facts file with
 * provenance, and the writing model receives facts it did not gather and must not
 * contradict.
 *
 * FAILURE POLICY
 * Every value is null unless it was actually retrieved. Failures are recorded in
 * errors[] with the URL that failed. A null tells the writer "say you could not
 * source this"; a guess would become a permanent lie in the trend history. A
 * partial fetch is still a run — only a total wipeout of every critical adapter
 * fails the process.
 *
 * PRIVACY
 * Adapters must never fetch what must not be published (owner names, addresses,
 * coordinates, sub-ZIP geography). That rule lives in bin/adapters/README.md and
 * in each adapter's FORBIDDEN check — omission beats scrubbing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, ROOT } from './lib/config.mjs';
import { adapters } from './adapters/index.mjs';

const args = process.argv.slice(2);
const argv = k => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
const DRY = args.includes('--dry-run');

const config = loadConfig();
const week = argv('--week') || new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
  console.error(`--week must be YYYY-MM-DD, got "${week}"`);
  process.exit(2);
}
const OUTDIR = argv('--out') || 'data/facts';

// All windows derive from the issue date, not from "now" — reproducible re-runs.
const d = new Date(`${week}T12:00:00Z`);
const iso = x => x.toISOString().slice(0, 10);
const windowStart = iso(new Date(d.getTime() - 7 * 86400000));
const windowEnd = week;

const errors = [];
const notes = [];
const agentRules = [
  'These numbers were fetched, not inferred. Do not contradict them and do not recompute them from memory.',
  'A null means it could not be retrieved. Write that it could not be sourced; never substitute an estimate.',
  'Always pair a percentage with the absolute change, and heed every small-base rule below.',
  'Cite the query date shown in this file when reporting any of these figures.',
];

const facts = {
  week,
  generatedFor: config.siteName,
  generator: 'bin/fetch-data.mjs',
  zip: config.zip,
  geographyNote: config.geographyNote || null,
  queriedAt: DRY ? null : new Date().toISOString(),
  errors,
  notes,
  agentRules,
};

if (!adapters.length) {
  notes.push(
    'No data adapters are enabled yet (bin/adapters/index.mjs registers none). ' +
    'The issue must rely on cited research alone this week; there are no fetched figures to lead with. ' +
    'See bin/adapters/README.md to enable your first source.');
  console.log('fetch-data: 0 adapters enabled — writing a facts file with no data blocks.');
  console.log('  (This is the expected state of a fresh kit. Enable your first adapter');
  console.log('   via bin/adapters/README.md and the /find-sources skill.)');
}

const outcomes = [];
for (const adapter of adapters) {
  const before = errors.length;
  const ctx = {
    config, week, windowStart, windowEnd,
    addError: (source, url, message) => errors.push({ source, url, message }),
    addRule: text => agentRules.push(text),
    addNote: text => notes.push(text),
  };
  console.log(`fetch-data: ${adapter.name}${adapter.critical ? ' (critical)' : ''}`);
  try {
    facts[adapter.name] = DRY ? null : await adapter.fetch(ctx);
    const failed = errors.length - before;
    // "Total failure" = the adapter's block is null/empty or every top-level value
    // in it is null. A block of honest nulls is not a usable fetch.
    const block = facts[adapter.name];
    const values = block && typeof block === 'object' ? Object.values(block) : [];
    const anyValue = values.some(v => v !== null && v !== undefined);
    outcomes.push({ name: adapter.name, critical: adapter.critical, ok: !DRY && anyValue, failedQueries: failed });
    console.log(`  ${anyValue || DRY ? 'ok' : 'EMPTY'} — ${failed} failed quer${failed === 1 ? 'y' : 'ies'}`);
  } catch (e) {
    // An adapter that THROWS (rather than recording errors and returning nulls)
    // still must not kill the other adapters' data.
    facts[adapter.name] = null;
    errors.push({ source: adapter.name, url: '', message: `adapter threw: ${e.message}` });
    outcomes.push({ name: adapter.name, critical: adapter.critical, ok: false, failedQueries: errors.length - before });
    console.log(`  FAILED — ${e.message}`);
  }
}

if (!DRY) {
  mkdirSync(join(ROOT, OUTDIR), { recursive: true });
  const path = join(ROOT, OUTDIR, `${week}.json`);
  writeFileSync(path, JSON.stringify(facts, null, 2));
  console.log(`\nwrote ${OUTDIR}/${week}.json`);
} else {
  console.log('\n[dry-run] nothing written');
}

// Print the summary unconditionally — silence is not success.
console.log(`${adapters.length} adapter(s) · ${errors.length} failed quer${errors.length === 1 ? 'y' : 'ies'}`);
if (errors.length) {
  console.log('FAILED QUERIES (the issue must say these could not be sourced):');
  for (const e of errors) console.log(`  - ${e.source}: ${e.message}`);
}

// Only a total wipeout of the critical adapters is worth failing the workflow
// over — the writer is told what is missing rather than the whole week dying.
const criticals = outcomes.filter(o => o.critical);
if (!DRY && criticals.length && criticals.every(o => !o.ok)) {
  console.error('\nEvery critical adapter failed. Failing the run rather than publishing an issue with no sourced data.');
  process.exit(1);
}
