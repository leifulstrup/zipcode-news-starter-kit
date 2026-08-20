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
import { spawnSync, execFileSync } from 'node:child_process';
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
    // The gates' own fixture keeps a minimal stylesheet, so nothing exercised
    // them against the file instances actually inline — and a CSS comment
    // naming the markup it styled was extracted as a front-page headline,
    // shipping a phantom item into every RSS description and archive entry.
    // What the gates test and what instances ship must not be different files.
    name: 'verify accepts the issue with house-style.css inlined',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/styled-issue.html'],
    expectExit: 0,
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

// A stylesheet must never contribute content. The styled fixture inlines the
// shipped house stylesheet exactly as the brief instructs; if it yields more
// front-page headlines than the minimal fixture, a CSS comment is being read as
// editorial content again — the bug that put a phantom "…" at the top of every
// archive entry and RSS description.
try {
  const { readFileSync } = await import('node:fs');
  const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const heads = f => {
    const html = readFileSync(join(ROOT, 'fixtures', f), 'utf8')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
    return [...html.matchAll(/<p class="fp-h">([\s\S]*?)<\/p>/g)].map(m => strip(m[1]));
  };
  const plain = heads('good-issue.html'), styled = heads('styled-issue.html');
  const ok = plain.length === styled.length && !styled.some(h => /^[.…\s]*$/.test(h));
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: 'inlining the house stylesheet adds no phantom headlines',
    detail: ok ? '' :
      `minimal fixture yields ${plain.length} headlines, styled fixture ${styled.length}` +
      `${styled.filter(h => /^[.…\s]*$/.test(h)).length ? ' (and one is empty/ellipsis)' : ''} — ` +
      `a CSS comment is being parsed as content. Never put literal markup in a stylesheet comment, ` +
      `and strip <style> before scanning for structure.`,
  });
} catch (e) {
  failures++;
  rows.push({ result: 'FAIL', case: 'styled-fixture headline parity', detail: e.message });
}

// Appearance, not just presence. Skips itself when Chromium is absent, so this
// never blocks a publisher without a browser — but on any machine that has one
// (and in CI, which installs it for the PDF) it catches the class of failure
// every text-based gate is blind to.
{
  // Regenerate first: a stale styled fixture would prove the wrong thing.
  spawnSync(process.execPath, ['bin/make-styled-fixture.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const rc = spawnSync(process.execPath, ['bin/render-check.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const out = (rc.stdout ?? '') + (rc.stderr ?? '');
  const skipped = /SKIPPED/.test(out);
  const ok = rc.status === 0;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: skipped ? 'issue renders as designed (skipped: no browser)' : 'issue renders as designed',
    detail: ok ? '' : out.split('\n').filter(l => l.includes('::error::')).join(' ').slice(0, 300),
  });
}

// ---------------------------------------------------------------------------
// Configuration coherence. /setup tells the publisher this run "confirms the
// configuration is coherent" — a sentence that was false until these existed:
// doctor tested only the gates against fixtures and would have passed
// identically with a placeholder worker name and three contradictory
// schedules. A green check that does not check what it claims is worse than no
// check, because the publisher reads it and stops looking. (90706 field
// instance.) The invariants were already written down — as comments inside the
// very files that must agree; comments are not enforcement.
// ---------------------------------------------------------------------------
{
  const { loadConfig } = await import('./lib/config.mjs');
  const { readFileSync: rf, existsSync: ex } = await import('node:fs');
  const cfg = loadConfig();

  // Schedules must all derive from cronUtc. sync-crons owns the arithmetic —
  // doctor must never re-implement it, or the two drift and both look right.
  const sync = spawnSync(process.execPath, ['bin/sync-crons.mjs', '--check'],
    { cwd: ROOT, encoding: 'utf8' });
  const syncOk = sync.status === 0;
  rows.push({
    result: syncOk ? 'PASS' : 'FAIL',
    case: 'workflow schedules match site.config.json',
    detail: syncOk ? '' :
      'a workflow cron disagrees with cronUtc. A smoke test scheduled before the publish it ' +
      'verifies passes forever against last week\'s site. Fix:  node bin/sync-crons.mjs',
  });
  if (!syncOk) failures++;

  // wrangler.toml name must match workerName, or the deploy targets a
  // different Worker than every URL the kit prints.
  if (ex(join(ROOT, 'wrangler.toml'))) {
    const wr = rf(join(ROOT, 'wrangler.toml'), 'utf8');
    const nm = wr.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
    const ok = nm === cfg.workerName;
    rows.push({
      result: ok ? 'PASS' : 'FAIL',
      case: 'wrangler.toml name matches workerName',
      detail: ok ? '' : `wrangler.toml says "${nm}", site.config.json says "${cfg.workerName}" — ` +
        `the deploy would target a different Worker than the URLs the kit prints.`,
    });
    if (!ok) failures++;
  }

  // The half-updated state that is otherwise INVISIBLE: an instance has taken
  // ownership of its About page, then merges a build.mjs that does not know
  // about.html exists. The file survives, is silently ignored, the site quietly
  // reverts to generated prose, and every check stays green — the publisher finds
  // out when they notice their own corrections have vanished from a page nobody
  // looks at twice. Same shape as `--ours` dropping config keys. (90706 instance
  // flagged this while prototyping the feature.)
  if (ex(join(ROOT, 'about.html'))) {
    const buildSrc = rf(join(ROOT, 'build.mjs'), 'utf8');
    const ok = buildSrc.includes('ABOUT_FILE');
    rows.push({
      result: ok ? 'PASS' : 'FAIL',
      case: 'about.html is actually used by the build',
      detail: ok ? '' :
        'about.html exists but build.mjs has no support for it — your edited About page is being ' +
        'IGNORED and the site is serving generated prose. This is the shape a partial update ' +
        'leaves behind: take the kit\'s build.mjs from a version >= 0.14.0, or your ownership of ' +
        'that page is silently undone.',
    });
    if (!ok) failures++;
  }

  // Placeholders left behind after /setup mean a half-configured instance.
  // Skipped on an unconfigured clone, where placeholders are correct.
  if (cfg.zip !== '00000') {
    const stale = [];
    for (const f of ['site.config.json', 'wrangler.toml']) {
      if (ex(join(ROOT, f)) && /00000|Anytown|zipcode-news-00000/.test(rf(join(ROOT, f), 'utf8'))) stale.push(f);
    }
    rows.push({
      result: stale.length ? 'FAIL' : 'PASS',
      case: 'no placeholder values left in config',
      detail: stale.length ? `placeholder text (00000 / Anytown) still in: ${stale.join(', ')} — ` +
        `re-run /setup or edit by hand; a half-configured instance publishes the template's identity.` : '',
    });
    if (stale.length) failures++;
  }
}

// ---------------------------------------------------------------------------
// Repo-state checks. Not gates against fixtures — these catch a repo left in a
// state that will break a LATER step, which is the failure class /update-kit
// created: adding the template remote silently broke every `gh` command in
// /go-live, with weeks between cause and symptom. Doctor is what publishers are
// told to run when something is wrong, so the diagnosis belongs here.
// ---------------------------------------------------------------------------
function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

const remotes = (git(['remote']) || '').split('\n').filter(Boolean);
if (remotes.length > 1) {
  // 1. PRIVACY: a non-origin remote must not be push-capable. The template is a
  //    public repo; pushing this private instance to it would publish
  //    config/privacy.json — publisher name, email, home-area coordinates —
  //    bypassing the privacy gate entirely (the gate scans issues, not remotes).
  for (const r of remotes.filter(r => r !== 'origin')) {
    const pushUrl = git(['remote', 'get-url', '--push', r]);
    const disabled = !pushUrl || /^DISABLED$/i.test(pushUrl) || !/^(https?:|git@|ssh:)/i.test(pushUrl);
    rows.push({
      result: disabled ? 'PASS' : 'FAIL',
      case: `remote "${r}" cannot be pushed to`,
      detail: disabled ? '' :
        `PUSHABLE (${pushUrl}). A stray push would publish this private instance — including ` +
        `config/privacy.json — to that repo. Fix:  git remote set-url --push ${r} DISABLED`,
    });
    if (!disabled) failures++;
  }

  // 2. USABILITY: with >1 remote, gh cannot resolve the repo and every gh
  //    command in /go-live fails with a cryptic "multiple remotes detected".
  const resolved = git(['config', '--get-regexp', String.raw`^remote\..*\.gh-resolved$`]);
  const originUrl = git(['remote', 'get-url', 'origin']) || '';
  // Only a real GitHub origin yields a usable owner/repo slug; anything else
  // (a local path, a non-GitHub host) must fall back to a placeholder rather
  // than printing a filesystem path as if it were a repo name.
  const m = originUrl.match(/^(?:git@github\.com:|https:\/\/github\.com\/)([^/]+\/[^/]+?)(?:\.git)?$/);
  const slug = m ? m[1] : '<owner>/<repo>';
  rows.push({
    result: resolved ? 'PASS' : 'FAIL',
    case: 'gh can resolve which repo this is',
    detail: resolved ? '' :
      `${remotes.length} remotes and no gh default — every "gh" command will fail with ` +
      `"multiple remotes detected". Fix:  gh repo set-default ${slug}` +
      `   (gh secret also needs -R ${slug}; it ignores the default.)`,
  });
  if (!resolved) failures++;
}

const width = Math.max(...rows.map(r => r.case.length));
console.log('\ndoctor — gate self-test against fixtures/\n');
for (const r of rows)
  console.log(`  ${r.result}  ${r.case.padEnd(width)}  ${r.detail}`);
console.log('');

if (failures) {
  console.error(`DOCTOR FAILED — ${failures} check(s) failed. A gate that cannot catch its fixture will not catch the real thing; a repo-state failure will break a later step. Each line above says what to fix. Do not publish until this is green.`);
  process.exit(1);
}
console.log(`doctor passed — ${rows.length} checks. The gates catch what they claim to catch.`);
