# Operations — how this publishes and what to do when it does not

One authoritative runbook. The architecture-level agreements between tools live in
`docs/CONTRACT.md`; this file is about running the thing.

## The pipeline in one paragraph

A GitHub Actions job runs every week on your configured day. A script fetches the
week's data into a facts file; an agent writes the issue from those facts and the
standing source registry; two gates check privacy and the publication promises and
can fail the run; scripts render the PDF and build the static site; the job commits.
The commit is what Cloudflare notices. **The repository is the whole publication** —
no laptop is in the path.

```
bin/fetch-data.mjs  →  AGENT writes issues/<WEEK>.html  →  bin/privacy-scan.mjs   (GATE)
                                                        →  bin/verify-issue.mjs   (GATE)
                       →  bin/normalize-issue.mjs  →  bin/html-to-pdf.mjs
                       →  build.mjs  →  bin/build-addendum.mjs  →  git commit
                       →  Cloudflare builds and deploys
```

The agent step is the only model-specific part. Everything on either side is plain
Node, which is what makes writing models swappable by one workflow input.

Three consequences of the two-system split, all load-bearing:

1. **A green Actions run means BUILT, not DEPLOYED.** Cloudflare deploys
   asynchronously after the push; only the smoke test sees what a reader sees.
2. **Rollback is `git revert`**; Cloudflare follows the repo.
3. **A failed run publishes nothing.** Every gate exits nonzero before the commit
   step, and the commit is the deploy trigger — so a bad week is a red X and last
   week's issue still live. Silence is safer than a fabricated brief.

## The workflows

| Workflow | Schedule | Question it answers | Blind to | On failure |
|---|---|---|---|---|
| `weekly.yml` | Your `cronUtc` | Can an issue be written, and does it pass the gates? | Whether it deployed | Red X; `review` issue if the addendum flagged anything |
| `smoke.yml` | After publish + daily | Is the site serving, with its disclosures intact? | Whether it's *this* week's issue | `site-down` issue |
| `publication-check.yml` | The morning after + a backstop day | Does the week that should exist, exist? | Whether the content is good | `not-published` issue |
| `sources.yml` | Weekly probe + monthly retrospective | Are the sources alive, and did printed figures stay true? | Everything downstream | `source-down` issue; commits probe/retrospective data |
| `daily.yml` (opt-in) | `daily.hourUtc` | Did anything genuinely change since yesterday? | Publication quality (it's a private radar) | Red X only — see below; no watchdog issue |

**Daily digest failure modes** (only if you enabled it via `/enable-daily`): a
day with no email is either a **quiet day** (normal — the model never even ran)
or a **dead run**, and only the Actions tab distinguishes them: quiet days show
a green run with a "quiet day" notice; a **red X on `daily.yml` means the run
died**, not that the day was quiet. Recovery: re-dispatch with the date —
`gh workflow run daily.yml -f date=YYYY-MM-DD -f force_send=true`. The
publication-check watchdog does not cover the digest. If digests start
repeating old items, the state baseline was lost — check that `data/daily/`
commits are landing on `main`.

Each watchdog opens at most **one** issue per label at a time, and each is designed
not to share the failure mode of the thing it watches (the publication check's core
assertion needs no network, because GitHub being down is one of the things it
catches). **Silence means the system is working.**

GitHub cron notes: it ignores daylight saving (your publish hour drifts one hour for
part of the year — accept it or edit the cron twice a year), scheduled workflows
run only from the default branch, and **GitHub silently drops scheduled runs during
platform incidents and never retries them** — which is exactly why
`publication-check.yml` exists and why it runs on two different days.

## When a label fires

**`review`** — the editor's addendum (`addendum/<WEEK>.html`, generated per run,
never published) flagged something a human should look at before trusting the
issue: an untraceable claim, a figure that may be a small-base artifact, an issue
suspiciously far under normal size. Read the checklist in the GitHub issue, check
the flagged items against sources, and log what you find in
`data/accuracy-log.md`.

**`site-down`** — the smoke test failed against the live URL. Check the Cloudflare
dashboard's Active deployment first (was there a deploy? did it match the commit?),
then the failure-signatures table in `docs/SETUP-CLOUDFLARE.md`.

**`not-published`** — the diagnosis is in the issue body, and it matters because the
two causes need opposite responses:

- **No weekly run exists for that date** → the cron never fired (almost always a
  GitHub platform incident). Fix: `gh workflow run weekly.yml -f week=<YYYY-MM-DD>`.
  Everything downstream keys off the `week` input, so a late issue is dated
  correctly.
- **A run exists and failed** → read that run's log. If it failed *after* the issue
  was written (the commit step, say), **recover the built issue and PDF from the
  run's artifacts** rather than re-running — a re-run costs a full research pass
  and will not reproduce the same issue.

**`source-down`** — a probe found a source missing, moved, or answering with the
wrong shape. Check the probe output in `data/probes/`, fix or retire the source in
`data/sources-ranked.md` (and the adapter if one exists), and record the change in
`data/source-log.md`.

## Skipping a week

Add the date (YYYY-MM-DD) to `data/skipped-weeks.txt` **before** the publication
check runs, one date per line. This is the designed legitimate-quiet path — without
it, a deliberate holiday skip would page you every day until you silenced the
check, and a silenced check is worse than no check. **Never add a date there to
quiet a real failure.**

## What may be changed in a published issue

Readers are promised that archived issues are kept as published. The precise rule:

- **Never changed — anything the issue asserted.** A figure, a date, a legal
  status, an attribution. If wrong, it is corrected in a *later* issue, never
  silently rewritten.
- **Fixed freely — anything broken rather than stated.** A dead link, markup that
  renders wrongly, a contact address that no longer works.

The test: would correcting this change what the issue *asserted*? If no, fix it.

## Diagnosing a failed weekly run

1. **Read the agent step's result block before theorizing.** `is_error: true` with
   ~1 turn and $0 cost = the invocation or credential, not the model.
   `stop_reason: end_turn` with no issue file = the agent stopped early; read its
   closing message and `permission_denials` (a tool missing from the allowlist is
   refused *silently* — that array is the only trace). Zero web searches on a run
   that should research = no research happened, whatever the prose says. Turns at
   the max = truncated mid-draft.
2. **If output is hidden, unhide it** (`show_full_output: true`) before forming a
   second hypothesis. The reference publication chased two wrong theories while the
   real error sat behind that flag.
3. **Known signatures**: instant fail at $0 → line break in the pasted token, or an
   empty-string secret shadowing a real one (pass only the credential you actually
   set). Agent "will be notified when research finishes" → it delegated to
   sub-agents, which die when the headless turn ends; the brief forbids this. Run
   fails at the commit step with `fetch first` → something pushed to `main`
   mid-run; the commit step rebases and retries, and if it still fails the issue is
   in the artifacts. Two navs/two footers on the site → a built page was saved back
   into `issues/`; the gate now catches it.

## Structural risks worth staring at

Three risks live in the *source set*, not the pipeline, and no gate fixes them:

1. **What the source set can see at all.** Official and civic sources skew toward
   property owners nearly everywhere; renters are a quarter to a half of most ZIPs
   and are barely represented in most registries. Careful sourcing inside a skewed
   set does not fix the skew — the audience rule in the editorial brief exists
   because of it, and `/add-source` is how the set improves.
2. **What is easiest to query dominates what gets written.** Crime is usually the
   best-structured local dataset, so it attracts weight out of proportion to its
   place in readers' lives — and an automated pipeline is *more* exposed to this
   than a newsroom, because its appetite is set by data availability rather than
   news judgement. Watch the section balance.
3. **Citations that look independent are not.** Local outlets routinely trace to
   the same police release or the same tip. The corroboration rules are written in
   terms of independent *observations*, not source counts, for this reason.

Keep any per-outlet bias notes **out of the repo**: useful internally, corrosive if
published under the masthead of a publication that depends on those same outlets.
The repo holds the behavior (tiers, rules); the reasoning stays with the editor.
