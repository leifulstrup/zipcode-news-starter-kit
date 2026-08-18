#!/usr/bin/env node
/**
 * doctor — prove the gates work before trusting them with a real issue.
 *
 *   node bin/doctor.mjs
 *
 * Runs every gate against fixtures/ (one known-good issue, several known-bad
 * ones) and exits non-zero if any gate mis-fires in either direction:
 *
 *   - the good fixture must PASS verify-issue and privacy-scan;
 *   - each bad fixture must FAIL, and fail on its INTENDED check — a fixture
 *     that fails for the wrong reason is a mis-fire too.
 *
 * The rule this encodes, learned the hard way in the reference implementation:
 * when a validator passes on input you know is bad, the validator is the bug.
 * Test every new gate against a real failing case before trusting it.
 *
 * Run this after editing any gate, any fixture, or config/ — and once right
 * after cloning, to prove the kit works on your machine.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/config.mjs';

const CASES = [
  {
    name: 'verify accepts the good issue',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/good-issue.html'],
    expectExit: 0,
  },
  {
    name: 'privacy-scan accepts the good issue',
    cmd: ['bin/privacy-scan.mjs', 'fixtures/good-issue.html'],
    expectExit: 0,
  },
  {
    name: 'verify rejects a missing disclosure',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/bad-no-disclosure.html'],
    expectExit: 1,
    expectMessage: /aibar|not reviewed by a human editor/i,
  },
  {
    name: 'verify rejects a fabricated figure (failed query, no admission)',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/bad-fabricated-figure.html',
          '--facts', 'fixtures/bad-fabricated-figure.facts.json'],
    expectExit: 1,
    expectMessage: /fabricated number/i,
  },
  {
    name: 'privacy-scan rejects a coordinate + second-person leak',
    cmd: ['bin/privacy-scan.mjs', 'fixtures/bad-privacy-leak.html'],
    expectExit: 1,
    expectMessage: /coordinate is an address/i,
  },
  {
    name: 'verify rejects a double-wrapped issue (site chrome present)',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/bad-double-wrapped.html'],
    expectExit: 1,
    expectMessage: /site chrome/i,
  },
  {
    name: 'verify rejects missing per-section sources',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/bad-missing-sources.html'],
    expectExit: 1,
    expectMessage: /Sources for this section/i,
  },
];

let failures = 0;
const rows = [];

for (const c of CASES) {
  const res = spawnSync(process.execPath, c.cmd, { cwd: ROOT, encoding: 'utf8' });
  const output = (res.stdout ?? '') + (res.stderr ?? '');
  const exitOk = res.status === c.expectExit;
  const msgOk = !c.expectMessage || c.expectMessage.test(output);
  const ok = exitOk && msgOk;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: c.name,
    detail: ok ? '' :
      !exitOk ? `exit ${res.status}, expected ${c.expectExit}` :
      `exited ${res.status} but not for the intended reason (message /${c.expectMessage.source}/ not found)`,
  });
  if (!ok) {
    console.error(`\n--- output of failing case "${c.name}" ---`);
    console.error(output.trim());
    console.error('--- end output ---\n');
  }
}

// Sanity-check the shared classification on the good fixture: the single
// definition every metric depends on must at least see the hosts.
try {
  const { sourceMix } = await import('./source-classes.mjs');
  const { readFileSync } = await import('node:fs');
  const mix = sourceMix(readFileSync(join(ROOT, 'fixtures', 'good-issue.html'), 'utf8'));
  const ok = mix.hosts.length >= 4;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: 'source-classes sees the good fixture\'s hosts',
    detail: ok ? '' : `only ${mix.hosts.length} hosts found — hostsIn() is broken`,
  });
} catch (e) {
  failures++;
  rows.push({ result: 'FAIL', case: 'source-classes loads', detail: e.message });
}

const width = Math.max(...rows.map(r => r.case.length));
console.log('\ndoctor — gate self-test against fixtures/\n');
for (const r of rows)
  console.log(`  ${r.result}  ${r.case.padEnd(width)}  ${r.detail}`);
console.log('');

if (failures) {
  console.error(`DOCTOR FAILED — ${failures} gate(s) mis-fired. A gate that cannot catch its fixture will not catch the real thing. Fix the gate (or the fixture) before publishing anything.`);
  process.exit(1);
}
console.log(`doctor passed — ${rows.length} checks. The gates catch what they claim to catch.`);
