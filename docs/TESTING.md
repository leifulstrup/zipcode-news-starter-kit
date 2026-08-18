# Testing the kit across ZIP codes

This protocol is for developers of the starter kit itself (not for publishers using
it). Its job is to answer: **does this framework generalize beyond the ZIP it was
extracted from?**

## Why three deliberately different ZIPs

The kit's hardest generalization axis is **data richness**. The reference
publication lives in a big-city ZIP with a first-class open-data portal; most of the
country does not. Every full test therefore runs against at least:

1. **A mid-size-city ZIP** — city or county open-data portal likely; the happy
   path.
2. **A suburban ZIP** — data usually lives at the county level under a different
   name than the town's; exercises the city/county/state sweep and the
   disambiguation step.
3. **A rural ZIP** — little or no structured data; exercises honest degradation.

A kit that only works where data.gov-grade portals exist is a DC kit with the serial
numbers filed off. A kit that pads thin ZIPs with filler is worse than no kit.

## Phase gates

Run in order; each phase must pass before the next is meaningful.

### Phase 0 — clean clone mechanics (any machine, no accounts)

- [ ] Fresh clone, `node build.mjs` exits 0 and produces `public/` with index,
      archive, about, feed.xml, sitemap, robots, 404.
- [ ] `node bin/doctor.mjs` green on the shipped placeholder config.
- [ ] Every `bin/*.mjs` prints something and exits per its CONTRACT §7 CLI when run
      with no arguments or `--help` (no silent scripts).
- [ ] Workflow YAML lints (`gh workflow list` on a pushed copy, or actionlint).

### Phase 1 — /setup produces a coherent instance

- [ ] Interview writes valid `site.config.json`, `config/privacy.json`,
      `wrangler.toml` name, and a cron line matching the chosen timezone/day.
- [ ] Privacy answers land as patterns; a planted string (tester's fake surname,
      fake street) is then caught by `node bin/privacy-scan.mjs` on a test file.
- [ ] `node bin/doctor.mjs` green; local serve shows the configured masthead.

### Phase 2 — /find-sources per test ZIP (the core test)

For each of the three ZIPs:

- [ ] The sweep covers the full taxonomy (portals, police, 311, assessor/deeds,
      courts, permits/zoning, inspections, crashes, schools, elections) at city,
      county, AND state level — check the transcript, not the outcome.
- [ ] **Jurisdiction verification is recorded** for every recommended source (the
      Springfield problem: a same-named city in another state planted in the
      candidate list must be caught and rejected with the reason logged).
- [ ] Every candidate — approved, rejected, parked — has a `data/source-log.md`
      entry with how-found, assessment, and verdict.
- [ ] Every registered source was **live-tested** (a fetch returning plausible rows
      for the actual jurisdiction), not just found.
- [ ] Outcome bar: a non-empty ranked registry with **at least one probeable
      structured data source, or an honest written finding that none exists** for
      this ZIP — never an empty-handed silence, never a padded registry.
- [ ] For the rural ZIP specifically: the skill says plainly that data is thin and
      proposes the reduced section list rather than inventing sources.
- [ ] `config/sources.json` classes are populated and `node bin/probe-sources.mjs`
      runs against whatever adapters were written.

### Phase 3 — /first-issue gauntlet

- [ ] An issue is drafted and passes: privacy-scan, verify-issue, normalize,
      html-to-pdf, build, doctor — in pipeline order.
- [ ] Deliberate sabotage is caught: insert a fake case number not in the facts
      file (verify must FATAL), a lat/lon pair (privacy must FATAL), and delete a
      standing section (verify must warn). **A gate that passes known-bad input is
      the bug.**
- [ ] The thin-ZIP issue reads honestly: short sections that say why, no invented
      color.

### Phase 4 — cloud (one ZIP is enough)

- [ ] /go-live path works on a throwaway private repo + free Cloudflare account:
      dry-run workflow green, real run publishes, smoke test green against the
      workers.dev URL, `not-published` check passes the morning after.
- [ ] Rollback drill: `git revert` the issue commit; site follows.

## Results log

Keep one row per ZIP per test round, in this file or beside it:

| Date | ZIP | Type (urban/suburban/rural) | Phase reached | Structured sources found | Honest-thin verdict | Failures found | Kit fixes filed |
|---|---|---|---|---|---|---|---|
| 2026-08-17 | 65804 (Springfield, Greene Co., MO) | urban mid-size | Phase 2 dry run (discovery only) | 4 live-tested: city ArcGIS hub (46 datasets, incl. tree inventory + sinkhole boundaries), state Socrata (ZIP-filterable), weekly food-inspection portal, statewide crash search; 2 live RSS outlets | Rich ZIP, happy path. Gaps: no public 311 dataset; police data is dashboards/PDF, no incident API | 5 disambiguation incidents survived — incl. search-engine AI twice attributing Springfield **Oregon's** GIS hub to Missouri, a Greene County **Ohio** health portal, a Springfield **NJ** school site, and records-portal SEO clones outranking the official court search | PASS-WITH-FINDINGS → fixes applied 2026-08-17: state-qualified query templates; AI-summaries-are-not-evidence rule; unconfirmable-jurisdiction-is-disqualifying rule; domain-state-token tactic; SEO-clone warning (find-sources §2–3) |
| 2026-08-17 | 60558 (Western Springs, Cook Co., IL) | suburban | Phase 2 dry run (discovery only) | 4 adapter-suitable: county assessor permits (municipality-filterable), parcel sales via parcel-universe crosswalk, medical examiner, CivicClerk meetings OData; weekly police blotter PDFs | Not thin — county supplied everything the village doesn't publish. Gaps: no 311 at any level; no inspection dataset for suburban Cook; courts manual-only | City→county→state climb worked as claimed. Found: one-plausible-row false-pass hazard (Chicago-only dataset returned 1 stray village row); township-keyed county data needs crosswalk; blotter retains only 4 weeks; stale agenda platform hid the live successor | PASS-WITH-FINDINGS → fixes applied 2026-08-17: volume-plausibility check; crosswalk/two-step-adapter step; retention-window + archive-on-run field; stale-platform-successor rule (find-sources §4–5) |
| 2026-08-17 | 04543 (Damariscotta, Lincoln Co., ME) | rural | Phase 2 dry run (discovery only) | 1 structured API (statewide parcels ArcGIS FeatureServer) + 2 machine-readable feeds (county paper RSS, town AgendaCenter RSS); 3 healthy sources bot-blocked (403) = manual-only; state Socrata domain is a dead redirect | Thin on the structured axis, viable as narrative-first with honest "not published for this area" notes. Real risk identified: redundancy with a strong county paper — differentiate on cross-town aggregation + datasets the paper doesn't mine | Two wrong-state "Lincoln County" sources surfaced naturally and were caught (county names collide worse than city names); dead `data.<state>.gov` portal; ZIP spans 3+ municipalities; school governance renamed mid-2025 (registry-rot hazard) | PASS-WITH-FINDINGS → fixes applied 2026-08-17: county-name disambiguation emphasis; dead-portal check; ArcGIS org-search technique; manual-only access class; multi-town ZIP question; quarterly institutional re-verification (find-sources §2–5) |

Every failure found here is a kit bug, not a tester error — file it, fix it, and if
it taught something durable, add the rule to the shipped
`data/lessons-learned.md` Part 1.
