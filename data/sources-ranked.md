# Standing Source Registry

**Publication:** _(from `site.config.json` — filled by `/find-sources`)_
**Scope:** _(ZIP, city, county, and the data geographies that actually cover it)_
**Audience:** everyone in the ZIP — owners *and renters*, newcomers, families,
commuters, retirees, local business. Never write as though every reader owns a
house.

**How to use this file.** Every source below is a *standing* source — check it on
the cadence listed, not only when something prompts you. This is a research plan,
not a bibliography: work it **by cadence, not on demand**. The **Insight** column is
the accumulated judgment about what a source is actually good for; the **Known
failures** column is what has already gone wrong, so it does not go wrong twice.
Read this file and `lessons-learned.md` before researching each week.

This file holds the **current roster** only. The full history of every source ever
considered — including rejected ones and why — lives in `data/source-log.md`.
Sources are added only via `/find-sources` or `/add-source`, with the publisher's
approval; the writing model never edits this file.

**Score:** 5 = check every week without fail · 4 = check weekly, often nothing ·
3 = useful, verify elsewhere · 2 = degraded or hard to reach · 1 = archive only.

**Class** (must match `config/sources.json`): **P** = primary (publishes the record
itself) · **IP** = interested-primary (authoritative for what it said/did, and an
interested party — never counted as primary) · **S** = secondary (describes records
others hold).

---

## Tier 1 — Structured data. Query these every week; they produce the numbers.

| Source | Class | Score | Cadence | Insight | Known failures |
|---|---|---|---|---|---|
| _(example — replace)_ Anytown open-data crime incidents, `data.example.gov` | P | 5 | weekly | Reported incidents by police district; counts and YoY only — district ≠ ZIP | Field names changed once without notice |

## Tier 2 — Government and agency pages. Weekly to monthly; they produce the decisions.

| Source | Class | Score | Cadence | Insight | Known failures |
|---|---|---|---|---|---|
| _(example — replace)_ Anytown council agendas | P | 4 | weekly | Agendas post Thursday; votes lag a week | Scraped dates unreliable — confirm on the PDF |

## Tier 3 — Local outlets and hyperlocals. The narrative layer; Tier C claims live here.

| Source | Class | Score | Cadence | Insight | Known failures |
|---|---|---|---|---|---|
| _(example — replace)_ Anytown Weekly Blog | S | 3 | weekly | Best for openings/closings and event texture; name it in the sentence | Often rewrites the police blotter — not independent of it |

## Tier 4 — Civic organizations and institutions (interested-primary).

| Source | Class | Score | Cadence | Insight | Known failures |
|---|---|---|---|---|---|
| _(example — replace)_ Anytown Neighborhood Assoc. | IP | 3 | monthly | Authoritative for its own votes/minutes; a participant on anything contested | Membership skews long-tenured owners — mind the audience rule |

## Tier 5 — Adjacent jurisdictions, seasonal, and archive-only sources.

| Source | Class | Score | Cadence | Insight | Known failures |
|---|---|---|---|---|---|
| | | | | | |

---

## Independence — pairs that do and do not corroborate

Corroboration is a second independent **observation**, not a second URL. Maintain
the local version of this table as it is learned:

| independent? | pair |
|---|---|
| yes | a recorded deed and a valuation model |
| yes | an agency dataset and an eyewitness account |
| **no** | two commercial estimates fed by the same listing service |
| **no** | an agency dataset and a news story about that dataset |
| **no** | two outlets citing the same press release |

## Degraded / blocked — do not spend turns here

Sources that are down, paywalled, moved, or unreadable. Listing them saves the
weekly run from rediscovering the dead end. Move them back up only after a probe
passes.

| Source | Why blocked | Since | Recheck |
|---|---|---|---|
| | | | |

## Standing asks of the publisher

Things the human can do that the pipeline cannot — an account that needs creating, a
records request worth filing, a person worth emailing once. Reviewed whenever the
registry is updated.

- _(none yet)_
