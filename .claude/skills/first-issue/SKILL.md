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
node QA-QC/measure-issue.mjs issues/<WEEK>.html
node bin/normalize-issue.mjs issues/<WEEK>.html
node bin/html-to-pdf.mjs issues/<WEEK>.html issues/<WEEK>.pdf "<siteName> — <WEEK>"
node build.mjs
node bin/render-check.mjs issues/<WEEK>.html
node bin/doctor.mjs
```

Notes on two of these:

- **measure-issue is advisory, not a gate — read its counts anyway.** They are
  cheap, deterministic evidence and they catch editorial failures the gates
  cannot. **The standing rule, confirmed twice in the field: when this tool
  reports zero on something the brief requires, the draft has usually written
  *around* the requirement rather than met it.** Investigate every such zero
  before dismissing it — the natural reaction to an advisory number is to wave
  it off, and that reaction has been wrong nearly every time. Real examples: a
  `renters: 0` on a draft that said "people who do not have a yard of their own"
  (reads neutral, isn't); a `contactRoutes: 0` on a draft that said "emailed to
  the City Clerk" without ever printing the address or phone — the fix was the
  single most useful thing added to that issue; a `smallBaseCaveats: 0` on a
  draft that *had* caveated a small base, but in words the detector missed, and
  rewriting it plainly improved the prose anyway. A zero can still be a
  measurement gap (identifier shapes vary by jurisdiction) — but establish that,
  don't assume it.
- **The PDF step needs Playwright's browser, which a fresh clone does not have**
  (`npm install && npx playwright install chromium`). If it's not installed,
  the step exits with instructions — expect that, say so, and offer to install
  or skip. A skipped PDF here is fine; CI installs its own.

If a gate fails: that is the system working. Fix the issue (not the gate) and
re-run. Explain each failure to the user in one plain sentence — the gates are the
kit's editorial promises made mechanical.

## 3b. Take ownership of the About page

Run `node build.mjs --eject-about` and read the result WITH the user. It writes
`about.html` once; from then on the build uses it and never regenerates it.

This matters more than it looks. That page carries the corrections policy, the
privacy statement, the independence claim and the not-advice disclaimer — the
sentences the publication will be held to. Two things to fix while you are both
looking at it:

- **The beat list comes from `sections`, which is an INTENT, not a claim about
  sourcing.** A field instance shipped a page promising two beats its own issue
  said, in print, it had no source for. Name only the beats they actually have
  sources for, and say plainly which they do not.
- **If there is no `contactEmail`, the page now says so** — that the publication
  expects errors and offers no route to report one. That is honest and
  uncomfortable, which is the point. If they would rather it not say that, the
  fix is an inbox (`docs/FEEDBACK-INBOX.md`), not deleting the sentence.

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
the next step is `/go-live` (if typing that isn't recognized — wrong launch
folder in the Claude Code terminal, or any Claude Cowork/desktop session — say
"read .claude/skills/go-live/SKILL.md and follow it"; that form works
everywhere).
