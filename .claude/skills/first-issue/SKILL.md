---
name: first-issue
description: Write and gate-check a first issue entirely locally — nothing is published — to prove the pipeline end to end and calibrate quality with the user. Use after /find-sources, or when the user says "write a test issue", "let's try one", "first issue".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch
---

# /first-issue — prove one issue locally before anything goes live

The principle: make one work end to end before scaling to automation. This issue
need not ever be published — it exists to prove the pipeline and to calibrate, with
the user, what good looks like. Tell the user that up front, and that this takes
roughly half an hour of research plus their reading time.

## 1. Fetch

Pick today's date as `<WEEK>`. If adapters exist in `bin/adapters/`, run:

```
node bin/fetch-data.mjs --week <WEEK>
```

and show the user the summary (what was retrieved, what failed). If no adapters are
configured yet, proceed with an empty facts file and tell the user plainly: this
issue will be research-only, and the numbers-driven sections will honestly say no
data pipeline feeds them yet.

## 2. Write

Follow `/write-issue` (which follows `prompts/write-issue.md` exactly) to draft
`issues/<WEEK>.html`. Do the research for real — this is the calibration issue, and
a placeholder issue calibrates nothing.

## 3. The gauntlet, in pipeline order

Run each and show the user what it checks and what it said:

```
node bin/privacy-scan.mjs issues/<WEEK>.html
node bin/verify-issue.mjs --week <WEEK>
node bin/normalize-issue.mjs issues/<WEEK>.html
node bin/html-to-pdf.mjs issues/<WEEK>.html issues/<WEEK>.pdf "<siteName> — <WEEK>"   # needs playwright; skip with a note if not installed
node build.mjs
node bin/doctor.mjs
```

If a gate fails: that is the system working. Fix the issue (not the gate) and
re-run. Explain each failure to the user in one plain sentence — the gates are the
kit's editorial promises made mechanical.

## 4. Read it together

Run `npm run serve` and have the user open the local URL. Then walk them through the
rubric's twenty-minute read (`QA-QC/RUBRIC.md`): the seven questions, one at a time,
against this issue. Ask them which sections they'd actually read weekly, what's
missing, and what feels padded — their answers are calibration data.

## 5. Log while it's fresh

- **`data/accuracy-log.md`**: log three claims per its method — the most
  consequential, the most quantitative, and one from a section whose rules you
  didn't write. Verify each against the cited source with the user watching.
- **`data/lessons-learned.md`** (Part 2): a dated entry with the user's reactions
  and anything that surprised either of you.

## 6. Commit and hand off

```
git add -A && git commit -m "issue: first local issue <WEEK>"
```

Tell the user: the pipeline is proven on a real issue. If the quality isn't there
yet, iterate here — another local issue is cheap, and going live with automation
multiplies whatever quality exists, it doesn't create it. When they're satisfied,
the next step is `/go-live` (if that comes back "Unknown command", restart Claude
Code from inside the kit folder, or say "read .claude/skills/go-live/SKILL.md and
follow it" — every skill works both ways).
