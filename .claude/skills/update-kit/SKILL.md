---
name: update-kit
description: Pull the latest improvements from the upstream zipcode-news-starter-kit template into this instance — new skills, gate fixes, workflow improvements — without touching the publisher's own config, sources, or published issues. Use when the user says "update the kit", "get the latest version", "am I behind?", or wants a new capability the kit shipped after they created their copy.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# /update-kit — pull upstream improvements into this instance

This repo was created from the **zipcode-news-starter-kit** GitHub template. A
template copy has **no git connection to the template** — improvements published
upstream (new skills, gate fixes, hardened workflows) do not arrive on their own.
This skill wires the connection once and merges updates safely, preserving
everything that makes this instance the publisher's own.

Explain that to the user in a sentence before starting, then proceed.

## 1. See what's new before touching anything

```
git remote get-url template >/dev/null 2>&1 || {
  git remote add template https://github.com/leifulstrup/zipcode-news-starter-kit.git
  # PUSH IS DISABLED ON PURPOSE — DO NOT "FIX" THIS.
  # `git remote add` creates a push URL as well as a fetch URL, and the template
  # is a PUBLIC repo. A stray `git push template`, `git push --all`, or an agent
  # being helpful about "pushing everything" would publish this private
  # instance's config/privacy.json — publisher name, personal email, home-area
  # coordinates — into a public repository, bypassing the privacy gate entirely
  # (the gate scans issues, not repo state). The exposure is worst for anyone
  # with write access to the template. Fetch-only is the only safe shape.
  git remote set-url --push template DISABLED
}
git fetch template
```

Then repair `gh`'s repo resolution, because adding a second remote breaks it:

```
ORIGIN_REPO=$(git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
command -v gh >/dev/null && gh repo set-default "$ORIGIN_REPO"
```

Why this matters: with two remotes, `gh` cannot tell which repo it is acting on
and every `gh` command fails with *"multiple remotes detected"* — including the
ones `/go-live` tells the user to run, possibly weeks later, with no visible
connection to the update that caused it. Resolve the repo from `origin`'s URL,
not from `gh repo view` (which is itself ambiguous once two remotes exist).
`gh secret` ignores the default repo even when set, so those commands need an
explicit `-R` — `/go-live` carries that already.

Both commands are **idempotent and safe to re-run**. They write to
`.git/config`, which is not version-controlled: an instance that already applied
either fix by hand is already in the correct state, the merge will not conflict
over it, and nothing needs undoing. Run `node bin/doctor.mjs` after any update —
it checks both conditions and prints the fix if either is missing.

Compare versions: read `package.json` → `version` here, and
`git show template/main:package.json` → `version` upstream. If they match, tell
the user they are current and stop. Otherwise read
`git show template/main:CHANGELOG.md` and **summarize, in plain language, every
version between theirs and upstream's** — what they'd gain. Ask whether to
proceed. (This is also the honest answer to "should I bother?" — a publisher
mid-week before an issue may prefer to wait.)

## 2. Protect what is theirs

Make sure the working tree is clean first (`git status --porcelain` — commit or
stash anything pending, with the user's OK).

Two kinds of files exist in an instance:

- **Theirs (never overwritten by an update):** `site.config.json`,
  `config/*.json`, `data/**` (registry, logs, facts, daily state), `issues/**`,
  `addendum/**`, `wrangler.toml`, adapter files the instance wrote under
  `bin/adapters/` (anything that is not `index.mjs`, `README.md`, or a
  `_template-*`), and any cron lines in `.github/workflows/*.yml` that /setup or
  /enable-daily customized.
- **The kit's (updates should win):** `bin/**` apart from instance adapters,
  `build.mjs`, `QA-QC/**`, `.claude/skills/**`, `docs/**`, `fixtures/**`,
  `prompts/**`, `README.md` (template documentation — but ask if the user
  customized theirs), `package.json`, `CHANGELOG.md`, workflow files apart from
  their cron lines.
- **Derived, conflict is irrelevant:** `docs/architecture.svg` — take either
  side; step 4 regenerates it from config anyway.

Three hand-merge cases — never blind-checkout these:

1. **`prompts/write-issue.md`** when the user customized their editorial brief —
   that conflict is real editorial work; walk them through it hunk by hunk.
2. **`data/lessons-learned.md`** — dual-owned by design: Part 1 (standing rules)
   is inherited kit content that upstream improves; Part 2 (the dated log) is
   the instance's irreplaceable history. Merge Part 1 from the kit, keep Part 2
   entirely theirs.
3. **`bin/adapters/index.mjs` on instances older than v0.7.0** — before v0.7.0
   this file was where instances hand-registered their adapters, and taking the
   kit's copy SILENTLY UNHOOKS EVERY ADAPTER while all gates stay green (a real
   incident). From v0.7.0 the file auto-discovers adapter files, so: take the
   kit's new index.mjs, then make sure each of the instance's adapter files
   exports its adapter object (`export const adapter = {...}` or default) —
   discovery picks them up with no list to edit. **Count the adapters before
   and after** (`node bin/fetch-data.mjs` prints the count; so does
   `bin/probe-sources.mjs`): if the count fell, stop and fix before committing.

For workflow files: take the kit's file wholesale, then re-patch the instance's
cron lines — the kit side usually carries other changes a hunk-level "ours"
would lose.

## 3. Merge

```
git merge template/main --allow-unrelated-histories --no-edit
```

(`--allow-unrelated-histories` is required: a template copy and the template
share no commit ancestry. This is expected, not a problem. Also expected:
**every file the instance has ever touched will conflict** — twenty add/add
conflicts on a lightly-customized instance is normal for unrelated histories,
not a sign anything went wrong. Work the list calmly with the ownership rule.)

On conflicts, resolve by the ownership rule above: `git checkout --ours` for
their files, `git checkout --theirs` for kit files, hunk-by-hunk for a
customized editorial brief. Explain each resolution in one plain sentence as you
go. After resolving: re-apply any instance customizations the merge may have
reverted in kit-owned files — check specifically that the **cron lines** in the
workflows still match `site.config.json` (`cronUtc`, and `daily.hourUtc` if the
daily digest is enabled), and that `wrangler.toml → name` still matches
`workerName`.

## 4. Verify before declaring victory

Run, in order, and fix anything that fails:

```
node bin/doctor.mjs
node build.mjs
node bin/next-step.mjs
node bin/render-architecture.mjs
node bin/probe-sources.mjs   # instances with adapters: the check most likely
                             # to catch a broken merge — run it every time
```

(Some of these arrive WITH the update itself — an instance coming from an early
version won't have had `next-step.mjs` or `render-architecture.mjs` before the
merge. Run them after, and don't read their earlier absence as a failure.)

A green doctor after a merge is the point of the fixture harness — trust it over
optimism. Confirm the adapter count matches the pre-merge count (§2 case 3). If
the new version's CHANGELOG mentions migration notes, follow them.

## 5. Commit and tell them what they got

```
git add -A && git commit -m "kit: update to v<new version> from template"
git push
```

Close by listing, from the CHANGELOG entries they just crossed, the one or two
things worth trying now (a new skill, a new command), each with its paste-able
sentence — e.g. *"Read `.claude/skills/enable-daily/SKILL.md` and follow it."*
Remind them: this skill can be re-run any time; step 1 always answers "am I
behind?" without changing anything.
