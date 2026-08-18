#!/usr/bin/env node
/**
 * probe-sources.mjs — source liveness, with meaning.
 *
 *   node bin/probe-sources.mjs [--json]
 *
 * WHY THIS EXISTS
 * 1. Endpoints rot. Layer ids get renumbered, fields get renamed, services move.
 *    Discovering that inside Friday's unattended publish run is the worst time;
 *    this runs on Monday so a dead source is known days before it matters.
 * 2. Documented is not the same as working. An endpoint established from its
 *    documentation has not been established at all — only a live query proves the
 *    field exists, the geography answers, and the count is plausible. Until an
 *    adapter's probes run green, nothing from that source belongs in print.
 *
 * It asserts MEANING, not status codes: a 200 that returns zero rows where rows
 * are expected is a failure here, because in a published issue it would become
 * "nothing happened", which is a lie rather than a gap.
 *
 * WHAT RUNS
 *   - every check returned by each adapter's optional probe() hook
 *   - a liveness HEAD/GET against each host in config/sources.json "primary"
 *     (non-critical: a homepage outage does not invalidate a data API)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSources, ROOT } from './lib/config.mjs';
import { adapters } from './adapters/index.mjs';

const checks = [];

for (const adapter of adapters) {
  if (typeof adapter.probe !== 'function') continue;
  const list = await adapter.probe();
  for (const c of list) checks.push({ ...c, adapter: adapter.name });
}

// Host liveness for the primary registry — a weaker signal than an adapter probe
// (a landing page can be up while an API is dead, and vice versa), so never
// critical. Its job is catching a registry host that vanished outright.
const sources = loadSources();
for (const host of sources.primary) {
  checks.push({
    name: `primary host reachable: ${host}`,
    critical: false,
    adapter: '(registry)',
    run: async () => {
      const r = await fetch(`https://${host}/`, { method: 'GET', redirect: 'follow' });
      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      return `HTTP ${r.status}`;
    },
  });
}

if (!checks.length) {
  console.log('probe-sources: nothing to probe yet — no adapter defines probe() and');
  console.log('config/sources.json lists no primary hosts. That is the expected state');
  console.log('of a fresh kit, not a failure. Enable an adapter (bin/adapters/README.md)');
  console.log('and classify your sources (/find-sources) to give this something to check.');
  process.exit(0);
}

const results = [];
for (const c of checks) {
  const started = Date.now();
  try {
    const detail = await c.run();
    results.push({ name: c.name, adapter: c.adapter, ok: true, detail, ms: Date.now() - started, critical: !!c.critical });
    console.log(`  PASS  ${c.name}\n        ${detail}`);
  } catch (e) {
    results.push({ name: c.name, adapter: c.adapter, ok: false, detail: String(e.message || e), ms: Date.now() - started, critical: !!c.critical });
    console.log(`  ${c.critical ? 'FAIL' : 'WARN'}  ${c.name}\n        ${e.message}`);
  }
}

const failed = results.filter(r => !r.ok);
const criticalFailed = failed.filter(r => r.critical);
console.log(`\n${results.length - failed.length}/${results.length} passed · ${criticalFailed.length} critical failure(s)`);

if (process.argv.includes('--json')) {
  const dir = join(ROOT, 'data', 'probes');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, `${stamp}.json`), JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2));
  console.log(`wrote data/probes/${stamp}.json`);
}

// A non-critical failure is information. A critical one means the next issue
// would be built on a source that is not there.
process.exit(criticalFailed.length ? 1 : 0);
