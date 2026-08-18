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
git remote get-url template 2>/dev/null || git remote add template https://github.com/leifulstrup/zipcode-news-starter-kit.git
git fetch template
```

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
  `addendum/**`, `wrangler.toml`, `docs/architecture.svg`, and any cron lines in
  `.github/workflows/*.yml` that /setup or /enable-daily customized.
- **The kit's (updates should win):** `bin/**`, `build.mjs`, `QA-QC/**`,
  `.claude/skills/**`, `docs/**` (except architecture.svg), `fixtures/**`,
  `prompts/**`, `package.json`, `CHANGELOG.md`, workflow files apart from their
  cron lines.

`prompts/write-issue.md` is the one judgment call: if the user has customized
their editorial brief, a conflict there is real editorial work — walk them
through it hunk by hunk rather than auto-resolving.

## 3. Merge

```
git merge template/main --allow-unrelated-histories --no-edit
```

(`--allow-unrelated-histories` is required: a template copy and the template
share no commit ancestry. This is expected, not a problem.)

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
```

A green doctor after a merge is the point of the fixture harness — trust it over
optimism. If the new version's CHANGELOG mentions migration notes, follow them.

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
