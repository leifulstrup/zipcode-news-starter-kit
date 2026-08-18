---
title: "The Seven Questions — a practical rubric for an AI-written local brief"
version: 1.1
date: 2026-08-17
changes_in_1_1: >
  Q1 now distinguishes quantitative claims (primary source required) from
  non-quantitative neighborhood claims (best available honest sourcing). The 1.0
  Strong band was unreachable by any honest desk-based brief — no primary source
  exists for a coffee-shop opening — and a dimension nothing can pass teaches
  nothing. Found by applying the rubric to real issues; the rubric's first catch
  was a fault in itself, which is what a working measurement layer does.
grounded_in:
  - "The Trust Project — 8 Trust Indicators (consortium standard, machine-readable schema)"
  - "Paris Charter on AI and Journalism — RSF + 16 partners, Nov 2023, principles 3–7"
  - "Solutions Journalism Network — four pillars (response, evidence, insight, limitations)"
  - "American Press Institute — Source Matters (adapted: institutional mix, not demographics)"
  - "Poynter Institute — verification discipline; 'neutrality must not compromise factual reality'"
  - "Tow Center for Digital Journalism — 'pink slime' as the failure mode to avoid becoming"
---

# The Seven Questions

A rubric you can use from memory. Seven questions, three bands each, no weights and
no composite score. If you need the document open to apply it, it has failed at its
job.

> **Q1 Traceability** — Can a reader get from any load-bearing claim to its best
> available source?
> **Q2 Honest uncertainty** — Does it admit what it does not know?
> **Q3 Local specificity** — Is this about *these blocks*, at the right geography?
> **Q4 Interest breadth** — Whose interests does the framing serve?
> **Q5 Actionability** — Can a reader do something with it?
> **Q6 Framing restraint** — Is the language proportionate to the evidence?
> **Q7 Machine-authorship disclosure** — Is the reader told, in seconds, what wrote this?

---

## Why this shape

**Reasoning, in five decisions:**

1. **No composite score.** A weighted sum produces a number that looks objective and
   hides every judgement inside it. Concretely: 90 on seven dimensions and 40 on
   framing still clears a threshold of 85. Averaging is exactly the wrong operation
   when some failures are disqualifying. **Bands plus a verdict rule, not arithmetic.**

2. **Gates stay separate from judgement.** The non-negotiables — no reader-identifying
   information, disclosure present, per-section sources, failed queries admitted — are
   already enforced in code by `bin/privacy-scan.mjs` and `bin/verify-issue.mjs`. They
   are binary and automated. This rubric governs only what code cannot decide. Mixing
   the two would let a gate failure be averaged away.

3. **Every question must be answerable by reading one issue.** No dimension requires
   on-scene reporting or interviews, because this publication does neither. A rubric
   that scores you permanently at "moderate" on 30% of its weight measures your
   business model, not your improvement.

4. **One diagnostic question per dimension.** Each reduces to a question you can hold
   in your head while reading. Seven questions in twenty minutes is a practice someone
   will actually keep.

5. **Weak on any question blocks publication; there is no trading up.** Strength
   elsewhere does not compensate. This is the opposite of a weighted average, and it
   is deliberate.

**Assumptions, stated so they can be disagreed with:**

- **A1.** Most readers arrive on a phone, skim the front page, and never open the
  About page. Anything that must reach them has to be visible in the issue itself.
- **A2.** The publication has no reporters, no interviews, no on-scene presence, and
  will not acquire them. Dimensions requiring those are out of scope permanently.
- **A3.** Fluent prose is the default failure mode of an AI writer, not clumsy prose.
  Therefore *misleading* matters more than *wrong*, and framing restraint is a
  first-class dimension rather than a polish item.
- **A4.** The writing model must not score its own output. Self-assessment measures
  confidence. Score with a different model, or a person, or both.
- **A5.** A reader who cannot check a claim is being asked to trust an unreviewed
  machine. Traceability is not a quality nicety — it is the entire basis on which
  this publication is defensible.
- **A6.** The audience is everyone in the ZIP: renters and owners, car-free and
  driving, with and without children in the schools. Framing that assumes a single
  reader profile is a defect even when every fact is correct.
- **A7.** Automated counts inform judgement; they do not replace it. A high citation
  count can decorate a weak claim. Use `measure-issue.mjs` as evidence, then read.

---

## The rubric

Each question: **Weak / Adequate / Strong**, with the evidence to look for and the
fix if it comes back weak.

### Q1 — Traceability
*Can a reader get from any load-bearing claim to its best available source?*

Two kinds of claim, held to two standards (the v1.1 change):

- **Quantitative claims** (counts, medians, percentages, dates of record): the
  standard is a **primary** source — agency dataset, filing, minutes, official
  notice — and figures fetched deterministically identifiable as such.
- **Non-quantitative neighborhood claims** (a shop opened, an event happened, a
  building is under renovation): no primary source exists for most of these, and
  that is fine. The standard is the **best available** source, cited honestly — and
  when that source is secondary, the sentence says so.

| Band | What it looks like |
|---|---|
| **Weak** | Load-bearing numbers or claims with no citation; sources named but not linked; citations pointing to an aggregator rather than the origin |
| **Adequate** | Every section carries sources with visible URLs; most quantitative claims carry an inline citation; some quantitative assertions still rest on a secondary write-up |
| **Strong** | Every quantitative claim resolves to a primary source; every non-quantitative claim carries its best available source, labeled as secondary where it is one |

**Evidence:** count inline citations; count sections with source lists; check host
classes in the measure output.
**If weak:** move the figure into an adapter under `bin/adapters/` so it is fetched
rather than researched, or cut the claim.

### Q2 — Honest uncertainty
*Does it admit what it does not know?*

| Band | What it looks like |
|---|---|
| **Weak** | States thin or single-observation figures flatly; no mention of anything that could not be sourced; false precision (a percentage off a handful of incidents, a one-month median as a trend) |
| **Adequate** | Hedges the weakest claims; mentions gaps generally |
| **Strong** | Names specifically what could not be obtained and what follows from that; small bases flagged where they occur; where a problem is covered, its limitations are stated rather than implied |

**Evidence:** hedge and limitation phrasing near quantitative claims; whether the
facts file's failed queries and small-base flags are reflected in the prose.
**If weak:** this is the most serious non-gate failure — an unreviewed AI publication
that projects false confidence has no defense. Fix in the brief, not the copy.

### Q3 — Local specificity
*Is this about these blocks, at the right geography?*

| Band | What it looks like |
|---|---|
| **Weak** | Regional or citywide material with no neighborhood consequence; geography mis-attributed (district figures labeled as the ZIP) |
| **Adequate** | Names local institutions and streets; geography correctly labeled but thinly explained |
| **Strong** | Named streets, addresses of public interest, institutions, dockets and boards; each geography explicitly and correctly identified; regional items present only with a stated local consequence |

**Evidence:** density of named local entities; correct district-versus-ZIP
attribution (your `geographyNote`); whether adjacent-jurisdiction items state why
they reach your ZIP.
**If weak:** the brief's scope section, and the standing-sections list.

### Q4 — Interest breadth
*Whose interests does the framing serve?*

| Band | What it looks like |
|---|---|
| **Weak** | Single implied reader — usually a car-owning homeowner; "property value" framing; renters, transit users and school families invisible |
| **Adequate** | Mostly neutral framing; one or two items acknowledge a second constituency |
| **Strong** | Consequences named for distinct constituencies where they differ — renters and owners, car-free and driving, families using the schools, the adjacent jurisdiction, small commercial tenants |

**Evidence:** framing language per item; explicit mention of constituencies whose
stake differs.
**Note:** the adapted form of the Trust Project's "Diverse Voices" and API's Source
Matters. This publication quotes nobody, so it cannot mean voices. It means
*interests*.
**If weak:** the audience section of the brief.

### Q5 — Actionability
*Can a reader do something with it?*

| Band | What it looks like |
|---|---|
| **Weak** | Informative only; no dates, no deadlines, no contacts, no way to participate |
| **Adequate** | A calendar of upcoming meetings; links to the bodies involved |
| **Strong** | Dates *and* times *and* access details; comment deadlines; docket, bill or case identifiers; the specific office to contact; open-data links so a reader can check the figures themselves |

**Evidence:** count of dates with times; docket/bill/case identifiers; deadlines;
named offices with contact routes.
**If weak:** the cheapest high-value improvement available — and the reference
implementation's experience says a prompt instruction alone will not move it.
Identifiers must be *fetched* (an adapter), not asked for.

### Q6 — Framing restraint
*Is the language proportionate to the evidence?*

| Band | What it looks like |
|---|---|
| **Weak** | Superlatives, alarm, clickbait construction; crime-led without context; false balance on a matter of established fact |
| **Adequate** | Neutral tone; occasional unearned intensifier |
| **Strong** | Every intensity claim matched to its evidence; year-over-year and base sizes given alongside changes; crime placed in context rather than led with; no both-sidesing of settled facts |

**Evidence:** superlative density; whether percentage changes appear with absolute
numbers and prior-period comparisons (the `pairedShare` metric).
**If weak:** brief, plus a candidate automated warning.

### Q7 — Machine-authorship disclosure
*Is the reader told, in seconds, what wrote this — and how to check it?*

| Band | What it looks like |
|---|---|
| **Weak** | Disclosure buried, absent, or softened; a reader could finish an item believing a person reported it |
| **Adequate** | Disclosed on the page and in the About section |
| **Strong** | Disclosed above the fold on every issue, on every printed page, in metadata, and in the archive; states that no human editor reviewed it; gives a route to report an error |

**Evidence:** presence and prominence of the disclosure bar, PDF footer, metadata,
About link, feedback route.
**Grounding:** Paris Charter principles 4 (accountability), 5 (transparency),
6 (traceability), 7 (authentic versus synthetic).
**Note:** the dimension on which a publication like this is most easily judged in
bad faith if it slips.

---

## Publication-level, checked quarterly rather than per issue

**Q8 — Accuracy record.** Trailing eight issues in `data/accuracy-log.md`: three
claims per issue verified against their cited source, categorized
correct / misleading / wrong. **Strong** = no wrong claims and at most one
misleading per issue. This is the standard for removing "(Experimental)" from the
masthead — see `data/accuracy-log.md` for the procedure.

**Q9 — Source mix.** Monthly: what share of items originate in government data,
official releases, civic associations, local business, and residents. Not a
per-issue score — a drift indicator. Heavy dependence on machine-readable official
sources is institutional bias wearing a different costume: an automated pipeline's
appetite is set by data availability rather than news judgement, so what is easiest
to query will quietly dominate what gets written unless you watch for it.

---

## Prohibitions — the anti-patterns

1. **Never generate a quotation.** Quotes are reproduced from a cited published
   source or they do not appear. Never paraphrase into quotation marks. A model told
   to raise a "community voice" score has fabrication as its cheapest available
   action — this is the single most hazardous instruction you could give it.
2. **Never improve a score by adding unsourced material.** If a dimension is weak
   because the material is not there, the honest remedy is a shorter issue.
3. **Never let the writing model score its own issue.**
4. **Never publish a figure that was not fetched or cited.** Not hedged — not
   published.

---

## How to use it in twenty minutes

1. Read the front page. Answer Q6 and Q7 — they are visible immediately.
2. Pick the three claims a reader might act on. Follow each to its source. That is Q1.
3. Re-read those three for hedging and base sizes. That is Q2.
4. Scan section headings and the calendar. That is Q3 and Q5.
5. Ask who each item is written for. That is Q4.
6. Log the three verified claims in `data/accuracy-log.md`.

Verdict rule: **publishable if no question is Weak, and Q1 and Q7 are Strong.**
Everything else is an improvement target, not a blocker.
