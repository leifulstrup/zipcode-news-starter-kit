---
name: write-issue
description: Write this week's issue of the newsletter from the pre-fetched facts file and the standing source registry. Use when producing the weekly neighborhood brief for the configured ZIP code.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch
---

# Write this week's issue

The issue date is the argument passed to this skill (`YYYY-MM-DD`). If none was
passed, use today's date in UTC.

**Follow `prompts/write-issue.md` in the repository root exactly.** It is the single
source of truth for this task and is shared with every model path, so it must not be
duplicated or paraphrased here — read it and do what it says.

Start by reading, in this order:

1. `prompts/write-issue.md` — the brief
2. `site.config.json` — the publication's identity
3. `data/facts/<WEEK>.json` — the week's fetched numbers, which you must not contradict
4. `data/sources-ranked.md` — the research plan
5. `data/lessons-learned.md` — the accumulated rules
6. the most recent file in `issues/` — the house style to match

Your only output is `issues/<WEEK>.html`. Do not build the site, render the PDF,
or commit — later workflow steps handle all of that.
