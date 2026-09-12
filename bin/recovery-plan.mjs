#!/usr/bin/env node
/**
 * When a week did not publish, decide what to do about it.
 *
 *   node bin/recovery-plan.mjs --week 2026-09-11
 *   node bin/recovery-plan.mjs --week 2026-09-11 --runs-json fixture.json   # offline, for tests
 *
 * WHY A SCRIPT AND NOT SIX LINES OF YAML
 * This is the one place in the kit that decides to SPEND MONEY or to PUBLISH without a human
 * in the loop, and it gets that wrong in two opposite and expensive directions:
 *
 *   - Retry when the edition already exists in a run artifact, and you pay for a second
 *     research pass to produce a DIFFERENT issue — and, because a draft for the week exists,
 *     an edit rather than a fresh one. The reference implementation lost an edition exactly
 *     this way on 2026-09-11: it was written, it passed every gate, and the step AFTER the
 *     gates failed. Re-running would have thrown the good one away and billed for it.
 *   - Retry without bound, and two check crons plus each retry's own failure become a loop
 *     against a paid API. For a publisher who is not watching the Actions tab, that is the
 *     worst thing this kit could do.
 *
 * So the decision is a pure function of the run list, doctor drives it through every branch
 * offline, and it is readable without reading YAML. The workflow executes the plan.
 *
 * THE PLAN IS ONE OF THREE
 *   recover  — a failed run for this week left a downloadable artifact. Publish THAT, after
 *              putting it through every gate again. No model call, and it is the edition
 *              that already passed.
 *   retry    — nothing usable exists. Dispatch the weekly workflow once more.
 *   give-up  — already retried, or a run is still in flight. A human is needed; the caller
 *              opens the issue. Never a fourth option, and never silence.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * It does not gate the recovered issue — the workflow does, after the download. A planner
 * that also judged would be a planner that could decide to publish something the gates
 * reject.
 */

import { spawnSync } from 'child_process';
import { readFileSync, appendFileSync } from 'fs';

const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };

const week = arg('--week');
const runsJson = arg('--runs-json');
/* How many dispatched retries this week is allowed. One. The point of a bound is that it is
   small; "a few" is how an API bill happens overnight. */
const MAX_RETRIES = Number(arg('--max-retries') ?? 1);

if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
  console.error('usage: recovery-plan.mjs --week YYYY-MM-DD [--runs-json f] [--max-retries n]');
  process.exit(2);
}

const gh = args => {
  const r = spawnSync('gh', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`gh ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r.stdout;
};

/* The run list, either live or from a fixture. The fixture path is what makes this testable
   without a GitHub account, a failed run, or a week of waiting for one. */
let runs;
if (runsJson) {
  runs = JSON.parse(readFileSync(runsJson, 'utf8'));
} else {
  runs = JSON.parse(gh(['run', 'list', '--workflow=weekly.yml', '--limit', '30',
    '--json', 'databaseId,createdAt,status,conclusion,event,url']));
}

/* Runs that belong to THIS week's publication attempt. Anything created before the Friday
   is a different week's business, and anything still in flight must not be treated as a
   failure — a check that fires while the run is working would dispatch a second one
   alongside it. */
const forWeek = runs.filter(r => r.createdAt >= `${week}T00:00:00Z`);
const inFlight = forWeek.filter(r => r.status !== 'completed');
const retries = forWeek.filter(r => r.event === 'workflow_dispatch').length;

const emit = (plan, reason, runId = '') => {
  const out = { plan, reason, runId: String(runId), week,
                runsForWeek: forWeek.length, retriesSoFar: retries };
  console.log(JSON.stringify(out, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      `plan=${plan}\nreason=${reason}\nrun_id=${out.runId}\nretries=${retries}\n`);
  }
  process.exit(0);
};

if (inFlight.length) {
  emit('give-up',
    `A weekly run for ${week} is still in flight (${inFlight[0].url}). Nothing to do yet — ` +
    `dispatching now would put two runs on the same edition.`);
}

/* Artefacts first, ALWAYS. An edition that exists costs nothing to publish and a retry costs
   a research pass and produces a different issue, so this order is the whole point of the
   script. Newest failed run first: if the scheduled run failed and a retry also failed, the
   retry's draft is the more recent attempt. */
const failed = forWeek
  .filter(r => r.conclusion !== 'success')
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

if (!runsJson) {
  for (const r of failed) {
    let arts;
    try {
      arts = JSON.parse(gh(['api', `repos/{owner}/{repo}/actions/runs/${r.databaseId}/artifacts`,
        '--jq', '{artifacts: [.artifacts[] | {name, expired, size_in_bytes}]}']));
    } catch { continue; }
    const hit = (arts.artifacts || []).find(a => a.name === `issue-${week}` && !a.expired && a.size_in_bytes > 0);
    if (hit) {
      emit('recover',
        `Run ${r.databaseId} failed but left artefact "${hit.name}" (${hit.size_in_bytes} bytes). ` +
        `Publishing that costs nothing and is the edition that passed the gates; re-running the ` +
        `agent would cost a research pass and produce a different issue.`,
        r.databaseId);
    }
  }
} else if (failed.length && failed[0].hasArtifact) {
  // Fixture mode: the test states directly whether an artefact exists.
  emit('recover', `Run ${failed[0].databaseId} failed but left a usable artefact.`, failed[0].databaseId);
}

if (forWeek.length === 0) {
  emit('retry',
    `No weekly run exists for ${week} at all — the scheduled trigger never fired. GitHub drops ` +
    `scheduled runs during platform degradation and does not retry them, so this is very likely ` +
    `a platform incident rather than a fault in this repository.`);
}

if (retries >= MAX_RETRIES) {
  emit('give-up',
    `${forWeek.length} run(s) exist for ${week}, ${retries} of them dispatched retries, and none ` +
    `produced a recoverable edition. The retry budget (${MAX_RETRIES}) is spent. This needs a ` +
    `human: retrying again would spend another research pass against a failure that has already ` +
    `repeated.`);
}

emit('retry',
  `${forWeek.length} run(s) exist for ${week} and none left a recoverable artefact, so the cycle ` +
  `failed before the issue was built. That is the case a retry can actually fix.`);
