---
name: find-sources
description: Discover, vet, and register the data sources and news outlets around the user's ZIP code — open-data portals, agency datasets, local outlets — with live testing, jurisdiction verification, and the user's approval on every source. Use after /setup, or when the user says "find sources", "what data is out there", "build the source registry".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch
---

# /find-sources — build the source registry for this ZIP

You are helping a user discover what can actually be known, on a schedule, about
their ZIP code. **Most users have no idea these data opportunities exist.** Your job
is equal parts research and education: sweep systematically, test what you find,
explain in plain language what each source could power in the newsletter, and let
the user decide. Read `site.config.json` first for the ZIP, city, county, and state.

Three standing rules:

- **No source enters the registry without the user's explicit approval.** You
  propose; they decide. This is the same human-approval rule the running newsletter
  applies to reader-suggested sources.
- **Every candidate — approved, rejected, or parked — gets an entry in
  `data/source-log.md`** (the append-only discovery log). Rejected sources stay
  there with the reason, so they are never re-proposed cold.
- **Documented is not working.** A dataset page is a claim; only a live fetch that
  returns plausible rows for THIS jurisdiction is evidence. Never register a source
  you did not test.

## 1. Interview first

Ask, one at a time:

1. **Which local outlets, blogs, newsletters, or agencies do you already read and
   trust?** Record each with why.
2. **Are there sources you want to AVOID?** (An outlet they consider unreliable, a
   feed that's all press releases, a site with paywalled everything.) Record each
   with their stated reason — these go into `data/source-log.md` with verdict
   `rejected (publisher)` and are honored from then on.
3. **What neighborhood associations, civic groups, school communities, or
   institutions do you know of locally?** These usually become `interestedPrimary`
   sources — explain that idea when it first comes up: a neighborhood association is
   the authoritative record of what *it* said and decided, and also an interested
   party on anything contested, so the kit tracks it separately from neutral records.
4. **What do you most want the newsletter to cover?** Their answer weights the
   search below.

## 2. The systematic sweep

Search at **city, county, AND state level** — many towns publish nothing themselves
while their county or state publishes a lot about them. For each category below, try
targeted searches (`"<city>" open data portal`, `"<county> county" GIS`, `<state>
judiciary case search`, `site:data.<city>.gov`, and the platform-specific patterns —
Socrata/Tyler Data & Insights (`data.<place>.gov`), ArcGIS Hub / Open Data
(`<place>.opendata.arcgis.com`, `gis.<place>.gov`), CKAN instances):

**The core civic set:**
- open-data portals (city, county, state)
- police / crime incident data
- 311 or service-request data
- property tax / assessor rolls; recorder of deeds / recorded sales
- court records (state judiciary portals, county clerk dockets)
- permits, zoning and land-use dockets, code enforcement, business licenses
- health / restaurant inspections
- traffic-crash data
- school district data (calendars, board agendas, enrollment)
- election data (registrar, upcoming ballots)

**The long tail that makes a newsletter distinctive:** once you find a portal,
**browse its actual catalog** rather than only querying this list — tree inventories
and urban forestry, capital-project trackers, library programming, parks and
recreation schedules, transit feeds, film permits, noise complaints, whatever this
particular government happens to publish. Surface **2–3 "you probably didn't know
your city publishes this" finds** — they are the seed of coverage no other outlet
has.

**The narrative set:** local news outlets large and small, hyperlocal blogs and
newsletters, the transit agency, parks department, and the adjacent jurisdictions
(the next town/county over that residents actually cross into).

## 3. Verify jurisdiction before anything else — the Springfield problem

Same-named places are a real hazard: the same city name exists in many states,
counties and cities share names, neighborhoods and streets repeat across metros.
**A dataset that merely name-matches the town is not vetted.** Before recommending
any source:

1. Confirm the ZIP's true city and county (cross-check against census/USPS ZIP
   lookups, not just memory).
2. Confirm the source's publisher is the government (or outlet) of THAT city/county/
   state — right state, right county, and the ZIP actually inside the covered
   boundary.
3. **Record how you confirmed it** in the source-log entry ("confirmed: portal
   footer names <county>, <state>; test query returned streets in <city>").

## 4. Test live, then explain

For each promising dataset: fetch it. Confirm the ZIP or jurisdiction is actually
covered (a test query returning plausible rows for this geography), confirm it
updates (look at the newest record's date), and note the access shape (API endpoint,
CSV, HTML page). A 200 with zero rows where rows are expected is a failure, not a
pass.

Then present the candidates to the user as a ranked proposal, in plain language:
what the source is, what it could power ("this is what a weekly 'reported incidents'
section would be built on"), how fresh it is, and any caveats found in testing. Let
the user approve, reject, or park **each one**.

## 5. Record everything

- **`data/source-log.md`** — an entry for every candidate, approved or not, in the
  file's documented format: date, how found, your assessment (coverage, cadence,
  reliability, jurisdiction confirmation), the user's verdict and reason.
- **`data/sources-ranked.md`** — the approved roster, in the tier/score/cadence/
  Insight/Known-failures structure the file documents. Trusted-outlet answers from
  the interview seed the narrative tiers.
- **`config/sources.json`** — classify every approved host: `primary` (the record
  itself), `interestedPrimary` (authoritative for themselves, interested otherwise),
  `secondary` (writes about records), `noVintage` (silently-revising estimate
  sites), `officialIncident` (satisfies Tier-A for deaths/violence — police/agency
  hosts only), `adjacentJurisdictions`.
- **`site.config.json` → `geographyNote`** — ask about and record the local
  geography mismatch: what geography does the police data actually use (districts,
  beats, precincts — almost never ZIP)? School attendance zones? Council wards?
  Write the one-paragraph honest statement of how they differ from the ZIP; the
  About section of every issue will carry it.
- If the standing `sections` list in `site.config.json` doesn't fit what you found
  (no transit agency; a big college that deserves a section), propose edits and
  apply what the user approves.

## 6. Wire up what has an API

Where an approved source has a queryable API (Socrata, ArcGIS, CKAN, CSV), offer to
write an adapter in `bin/adapters/` from the templates there, then test it:

```
node bin/fetch-data.mjs --week <this week's date>
```

Show the user the resulting `data/facts/<week>.json` and explain the null-means-
not-retrieved contract in one sentence. Then run `node bin/probe-sources.mjs` and
fix or note anything it flags.

## 7. Be honest about thin ZIPs

Some ZIPs — especially rural ones — have little structured data. Say so plainly if
this is one. The kit works with fewer sections and a shorter issue; **better honest
and thin than padded.** An issue that says "no permit data is published for this
county" is doing its job.

## 8. Commit and hand off

Append a dated entry to `data/lessons-learned.md` summarizing what was found and
decided. Commit:

```
git add -A && git commit -m "sources: initial registry for <zip>"
```

Tell the user: the registry is live, and as they hear of new sources over time — a
neighbor's tip, a reader email, something you stumble on during weekly research —
**`/add-source`** vets and registers them one at a time. Next step now:
`/first-issue`.
