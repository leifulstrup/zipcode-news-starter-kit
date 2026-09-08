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
import { readFileSync, readdirSync } from 'node:fs';
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
  {
    // A MATCHED PAIR, which is the whole test: the two fixtures carry the same claim in
    // the same words, and differ only in whether a second narrative source sits in the
    // section. One must fail and one must pass. A single negative fixture would prove the
    // gate blocks something; only the pair proves it blocks the RIGHT something and still
    // lets the corrected version through.
    name: 'verify rejects a fatality count sourced to the incident feed alone',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/bad-fatality-count-one-source.html'],
    expectExit: 1,
    expectMessage: /FATALITY COUNT/,
  },
  {
    name: 'verify accepts the same fatality count once a narrative source characterises it',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/ok-fatality-count-characterised.html'],
    expectExit: 0,
  },
  {
    // A window that had not closed when it was measured. Not a lag problem — the facts
    // file's own queriedAt predates its own window end, so part of the week had not
    // happened yet. The reference instance published a superlative off exactly this
    // shape, from feeds with no lag at all (their lesson 197).
    name: 'verify rejects a facts window that had not closed when it was queried',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/good-issue.html',
          '--facts', 'fixtures/bad-future-window.facts.json'],
    expectExit: 1,
    expectMessage: /had not happened yet/i,
  },
  {
    // A POSITIVE fixture, and the only one here that guards a NUMBER rather than a
    // structure. A front page carrying exactly FP_MIN items must publish.
    //
    // Every other case in this file is a negative control, and negative controls cannot
    // catch a gate drifting away from the brief: they prove bad input fails, never that
    // permitted input still passes. The reference instance lost exactly this — it lowered
    // one of two front-page floors, the other kept rejecting the count the brief now
    // allowed, and the writer padded the issue to satisfy it (their lesson 198). A
    // fixture at the boundary would have gone red the day the floors disagreed.
    name: 'verify accepts a front page carrying exactly the minimum items',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/ok-min-frontpage.html'],
    expectExit: 0,
  },
  {
    // The masthead control (verify-issue §7). This covers the branch that matters
    // most — an issue published without "(Experimental)" while the control still
    // requires it — using a fixture, like every other case here.
    //
    // The other three branches (site.config.json flipped out from under the control,
    // a removal with no approvedBy/approvedOn, an unparseable control file) are NOT
    // self-tested, deliberately: they can only be exercised by writing to
    // data/experimental-status.json, and a test harness that mutates the control file
    // is exactly the access the control exists to deny. They were driven by hand as
    // negative controls at v0.17.0 — see that CHANGELOG entry and docs/TESTING.md.
    name: 'verify rejects an issue whose masthead drops "(Experimental)"',
    cmd: ['bin/verify-issue.mjs', '--file', 'fixtures/bad-masthead-unlabelled.html'],
    expectExit: 1,
    expectMessage: /masthead does not say "\(Experimental\)"/i,
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
  const { readFileSync: rf, existsSync: ex, writeFileSync: wf } = await import('node:fs');
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
    // Test the BEHAVIOUR, not the source text. The first version of this check
    // asked whether build.mjs contained the string "ABOUT_FILE" — which is a
    // proxy, and a broken one in both directions: a build with the feature
    // genuinely disabled still contains the token (so it reported PASS while an
    // edited About page was being ignored, demonstrated in the field), and any
    // rename of the constant makes a FATAL check fire on a build that works.
    // A check named for behaviour must test behaviour. Write a marker, build,
    // look for the marker in the output, restore.
    const aboutPath = join(ROOT, 'about.html');
    const original = rf(aboutPath, 'utf8');
    const marker = `doctor-about-marker-${process.pid}`;
    let ok = false, detail = '';
    try {
      wf(aboutPath, original + `\n<!-- ${marker} -->\n`);
      const built = spawnSync(process.execPath, ['build.mjs'], { cwd: ROOT, encoding: 'utf8' });
      const out = join(ROOT, 'public', 'about', 'index.html');
      ok = built.status === 0 && ex(out) && rf(out, 'utf8').includes(marker);
      if (!ok) {
        detail = built.status !== 0
          ? `build.mjs exited ${built.status} while testing about.html.`
          : 'about.html exists but its content does NOT reach public/about/index.html — your ' +
            'edited About page is being IGNORED and the site is serving generated prose. This is ' +
            'the shape a partial update leaves behind: take build.mjs from kit v0.14.0 or later.';
      }
    } finally {
      wf(aboutPath, original);                      // always restore, even on throw
      spawnSync(process.execPath, ['build.mjs'], { cwd: ROOT, encoding: 'utf8' });
    }
    rows.push({ result: ok ? 'PASS' : 'FAIL', case: 'about.html actually reaches the built page', detail });
    if (!ok) failures++;

    // Ownership freezes the prose. That is the point of ejecting — and its cost,
    // because kit corrections to the generated About text stop arriving. Make the
    // drift visible without ever touching their file.
    const stamped = Number((original.match(/about-template-rev:\s*(\d+)/) || [])[1] ?? 0);
    const current = Number((rf(join(ROOT, 'build.mjs'), 'utf8')
      .match(/ABOUT_TEMPLATE_REV\s*=\s*(\d+)/) || [])[1] ?? 0);
    if (current > stamped) {
      rows.push({
        result: 'WARN',
        case: 'about.html may be missing later kit corrections',
        detail: `your about.html was ejected at About-prose revision ${stamped || 'unknown'}; the kit is ` +
          `now at ${current}. The generated About text has been corrected since — read CHANGELOG.md for ` +
          `what changed and port what applies, then update the "about-template-rev" comment at the top ` +
          `of your file. Nothing has been changed for you; the page is yours.`,
      });
    }
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
// A version restated in prose drifts from the version in the file. This README carried
// "Version 0.16.9" over a package.json saying 0.17.0 — a full release behind, and nothing
// announced it, because a description of state kept separately from the state goes stale
// silently. Same shape as a prompt restating a gate's word list. The fix is to keep ONE
// authority (package.json) and check that everything pointing at it still agrees.
{
  const pkgVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const changelog  = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const readme     = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const problems   = [];

  if (!changelog.includes(`## [${pkgVersion}]`)) {
    problems.push(`CHANGELOG.md has no "## [${pkgVersion}]" entry for the version in package.json`);
  }
  // Prose must not restate the number. Pointing at package.json or the changelog is fine.
  const restated = readme.match(/\bVersion\s+v?\d+\.\d+\.\d+/i);
  if (restated) {
    problems.push(`README.md restates a version ("${restated[0]}") instead of pointing at package.json — ` +
      `it will drift, and the drift is silent`);
  }
  // The tag is advisory: it legitimately lags between the version bump and the release.
  const latestTag = git(['describe', '--tags', '--abbrev=0']);
  const tagNote = latestTag && latestTag !== `v${pkgVersion}`
    ? ` (latest tag ${latestTag} — expected once this version is released)` : '';

  if (problems.length) failures++;
  rows.push({
    result: problems.length ? 'FAIL' : 'PASS',
    case: 'the version agrees everywhere it appears',
    detail: problems.length
      ? problems.join('; ') + '. Keep package.json as the single authority.'
      : `${pkgVersion}${tagNote}`,
  });
}

// Source URLs must be clickable AND visible. This asserts the kit's own model issue
// links every one of its sources — a warning-level check, so nothing about the exit
// code would catch a regression here, and a span quietly reappearing in the fixture is
// how the old convention would come back. The kit taught the dead-text form in three
// mutually-agreeing places for its whole life; one of them was this fixture.
{
  const out = spawnSync(process.execPath,
    ['bin/verify-issue.mjs', '--file', 'fixtures/good-issue.html'],
    { cwd: ROOT, encoding: 'utf8' });
  const text = (out.stdout ?? '') + (out.stderr ?? '');
  const dead = /source URL\(s\) are printed as dead text/.test(text);
  const html = readFileSync(join(ROOT, 'fixtures', 'good-issue.html'), 'utf8');
  const anchors = (html.match(/<a[^>]*class="u"[^>]*href=/g) || []).length;
  const spans   = (html.match(/<span[^>]*class="u"[^>]*>\s*https?:/g) || []).length;
  const ok = !dead && anchors >= 10 && spans === 0;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: 'every source URL in the model issue is a working link',
    detail: ok ? `${anchors} linked, 0 dead` :
      `${anchors} linked, ${spans} dead-text — source entries must be <a class="u" href="URL">URL</a>. ` +
      `The URL stays the visible text, so paper and PDF are unchanged and the link works on the web.`,
  });
}

// The recency measure, at its two known bounds. A measurement that silently returns
// zero would look like a publication with no repetition at all — the most flattering
// possible failure, and invisible without a case whose answer is known in advance.
{
  const run = (cur, prev) => {
    const out = spawnSync(process.execPath,
      ['bin/check-recency.mjs', '--file', cur, '--previous', prev], { cwd: ROOT, encoding: 'utf8' });
    const m = ((out.stdout ?? '') + (out.stderr ?? '')).match(/already published — ([\d.]+)%/);
    return m ? parseFloat(m[1]) : null;
  };
  // An issue against itself is 100% by definition. Against a strict subset of itself it
  // must be lower, which also proves the comparison is directional rather than symmetric.
  const identical = run('fixtures/good-issue.html', 'fixtures/good-issue.html');
  const superset  = run('fixtures/good-issue.html', 'fixtures/ok-min-frontpage.html');
  const ok = identical === 100 && superset !== null && superset < 100;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: 'recency measures a known reprint at 100% and a partial one below it',
    detail: ok ? `identical ${identical}% · superset ${superset}%` :
      `identical ${identical}% (expected 100), superset ${superset}% (expected <100) — ` +
      `the measure is not discriminating, and a real reprint would read as original.`,
  });
}

// The rubric and the thing that measures it must agree on which questions exist. This is
// the prompt-describes-a-gate problem in its other form: QA-QC/measure-issue.mjs emits a
// key per question, RUBRIC.md defines them in prose, and nothing connects the two. Renumber
// or rename a question and the measurement key becomes a dangling reference that still
// prints a number — the most convincing kind of stale, because it looks like evidence.
//
// Direction matters: every question the INSTRUMENT emits must exist in the RUBRIC, not the
// reverse. Q8 and Q9 are quarterly human reviews with no per-issue instrument, and that is
// correct rather than missing.
{
  const rubric = readFileSync(join(ROOT, 'QA-QC', 'RUBRIC.md'), 'utf8');
  const defined = new Set([...rubric.matchAll(/^(?:###\s*|\*\*)Q(\d+)\s*[—-]/gm)].map(m => m[1]));

  const run = spawnSync(process.execPath,
    ['QA-QC/measure-issue.mjs', 'fixtures/good-issue.html'], { cwd: ROOT, encoding: 'utf8' });
  let emitted = new Set();
  try {
    emitted = new Set(Object.keys(JSON.parse(run.stdout)).filter(k => /^Q\d+_/.test(k))
      .map(k => k.match(/^Q(\d+)_/)[1]));
  } catch { /* handled by the assertion below */ }

  const orphans = [...emitted].filter(q => !defined.has(q));

  // Second half, and the one that was missing: the instrument must not emit a band NAME the
  // rubric does not define for that question. Comparing question NUMBERS passed while
  // measure-issue.mjs was recording 'Weak' and 'Adequate' for Q10 — bands RUBRIC.md defines
  // for Q1-Q7 and never for Q10 — into the measurements archive every week. A rating against
  // a scale that does not exist reads exactly like a rating against one that does.
  //
  // Found by the reference instance in its own rubric (an evaluator asked for a band nobody
  // wrote will invent one) and confirmed here in a worse form: not a human inventing a rating,
  // a machine archiving one.
  const PER_ISSUE_BANDS = ['Weak', 'Adequate'];
  const src = readFileSync(join(ROOT, 'QA-QC', 'measure-issue.mjs'), 'utf8');
  const q10Section = (rubric.match(/^\*\*Q10\s*[—-][\s\S]*?(?=^---)/m) || [''])[0];
  const emittedBands = [...src.matchAll(/rubricBand:[\s\S]{0,400}?(?=\n\s*\w+:)/g)]
    .flatMap(m => [...m[0].matchAll(/'([^']+)'/g)].map(x => x[1]));
  const inventedBands = emittedBands.filter(b =>
    PER_ISSUE_BANDS.includes(b) && !new RegExp(`\\*\\*${b}\\*\\*`).test(q10Section));

  const ok = emitted.size > 0 && orphans.length === 0 && inventedBands.length === 0;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: 'the rubric defines every question AND every band the measurement emits',
    detail: ok
      ? `rubric Q${[...defined].sort((a,b)=>a-b).join(', Q')} · measured Q${[...emitted].sort((a,b)=>a-b).join(', Q')}`
      : emitted.size === 0
        ? 'measure-issue.mjs emitted no question keys — it did not run, or its output is not JSON'
        : orphans.length
          ? `measure-issue.mjs emits Q${orphans.join(', Q')} which RUBRIC.md does not define. ` +
            `A measurement whose question was renamed still prints a number, which reads as evidence.`
          : `measure-issue.mjs can record Q10 as ${inventedBands.map(b => `"${b}"`).join(', ')}, ` +
            `which RUBRIC.md defines for Q1-Q7 and not for Q10. Emit only bands the rubric defines ` +
            `for that question, and report threshold position in a separate field.`,
  });
}

// A path containing a space breaks two idioms, and the kit had already written the rule
// down: bin/lib/config.mjs says "never use import.meta.url.pathname: the path may contain
// spaces". It was then reintroduced three files away, in a different form
// (`import.meta.url === `file://${process.argv[1]}``), by someone who had read that comment.
// import.meta.url percent-encodes spaces; a hand-built file:// string does not, so the
// comparison silently never matches and the CLI becomes a no-op — no error, no output, and
// a green run. The reference instance hit the identical bug independently, in a folder named
// "20015 Weekly Newsletter".
//
// A comment protects the file it sits in. Publishers clone into ~/Documents/My Newsletter/,
// so this is a day-one failure for them. Hence a check rather than a sentence.
{
  const offenders = [];
  const scan = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') scan(rel); continue; }
      if (!entry.name.endsWith('.mjs')) continue;
      // This file is excluded by construction: it contains the offending patterns as regex
      // literals in order to look for them, and would report itself forever.
      if (rel === 'bin/doctor.mjs') continue;
      // Strip comments before scanning. The first version of this check flagged
      // bin/lib/config.mjs and bin/check-recency.mjs — whose comments STATE the rule — as
      // violations of it. A checker that cannot tell a rule from its documentation reports
      // the places someone did the work as the places they did not.
      const src = readFileSync(join(ROOT, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').filter(ln => !/^\s*(\/\/|\*)/.test(ln)).join('\n');
      if (/import\.meta\.url\s*\.pathname/.test(src))
        offenders.push(`${rel}: import.meta.url.pathname (percent-encoded — use fileURLToPath)`);
      if (/import\.meta\.url\s*===\s*`file:\/\//.test(src))
        offenders.push(`${rel}: compares import.meta.url to a hand-built file:// string (use pathToFileURL)`);
      if (/`file:\/\/\$\{/.test(src))
        offenders.push(`${rel}: builds a file:// URL by interpolation (use pathToFileURL)`);
    }
  };
  scan('bin'); scan('QA-QC');

  const ok = offenders.length === 0;
  if (!ok) failures++;
  rows.push({
    result: ok ? 'PASS' : 'FAIL',
    case: 'no script breaks when the repo path contains a space',
    detail: ok ? 'entry points and path resolution use pathToFileURL / fileURLToPath'
               : offenders.join('; ') + '. A path with a space makes these silently no-op.',
  });
}

console.log('\ndoctor — gate self-test against fixtures/\n');
for (const r of rows)
  console.log(`  ${r.result.padEnd(4)}  ${r.case.padEnd(width)}  ${r.detail}`);
console.log('');

if (failures) {
  console.error(`DOCTOR FAILED — ${failures} check(s) failed. A gate that cannot catch its fixture will not catch the real thing; a repo-state failure will break a later step. Each line above says what to fix. Do not publish until this is green.`);
  process.exit(1);
}
console.log(`doctor passed — ${rows.length} checks. The gates catch what they claim to catch.`);
