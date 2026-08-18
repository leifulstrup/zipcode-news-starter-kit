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
targeted searches — **always with the state in the query** (`"<city>, <state>" open
data portal`, `"<county> County, <state>" GIS`, `<state> judiciary case search`).
An unqualified `"<city>" open data` query manufactures the Springfield problem:
same-named cities in other states will outrank the right one. Qualifying the query
is necessary but not sufficient — wrong-state results still appear even in qualified
searches, which is why §3 verification is never skipped. Also try the
platform-specific patterns — Socrata/Tyler Data & Insights (`data.<place>.gov`),
ArcGIS Hub / Open Data (`<place>.opendata.arcgis.com`, `gis.<place>.gov`), CKAN
instances — with two field-tested cautions:

- **A resolving domain is not a live portal.** Some `data.<state>.gov` domains are
  dead 301 redirects to a vendor homepage. Check where the URL actually lands and
  whether a catalog with dated datasets exists before treating it as a portal.
- **ArcGIS endpoints often hide from the obvious patterns.** When
  `<place>.opendata.arcgis.com` finds nothing, search the ArcGIS Online catalog
  directly (`arcgis.com/sharing/rest/search` with the place and state as terms) and
  use the **owning organization** to discriminate — a state GIS office's org account
  (e.g. an org slug containing the state name) is the tell that separates the right
  "Lincoln County parcels" layer from the same-named layer in another state.

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
**County names collide even worse than city names** — for rural ZIPs the county is
the search key, and a name like "Lincoln County" or "Greene County" exists in a
dozen or more states. **A dataset that merely name-matches the town is not vetted.**
Before recommending any source:

1. Confirm the ZIP's true city and county (cross-check against census/USPS ZIP
   lookups, not just memory). Ask whether the ZIP contains **more than one
   municipality** — common in rural areas, where one ZIP spans several towns. Each
   town in the footprint has its own offices, agendas, and records; note them all.
2. Confirm the source's publisher is the government (or outlet) of THAT city/county/
   state — right state, right county, and the ZIP actually inside the covered
   boundary. For county-named domains, check the **state token in the domain
   itself** (`greenecountymo.gov` vs `greenecophoh.gov` — that two-letter token may
   be the only visible tell) *before* spending time reading its catalog.
3. **Record how you confirmed it** in the source-log entry ("confirmed: portal
   footer names <county>, <state>; test query returned streets in <city>").

Three hard rules learned in field testing:

- **A search engine's AI summary is never jurisdiction evidence.** Synthesized
  summaries have confidently attributed one state's GIS portal to another state's
  city of the same name. Only the fetched source itself — its footer, its metadata,
  its rows, its spatial extent — counts as confirmation.
- **Unconfirmable jurisdiction is disqualifying, not neutral.** If a source's own
  pages and metadata never positively state its state and county, reject or park it
  until out-of-band evidence (a linking .gov site, a spatial bounding box, rows with
  verifiable local street names) confirms it. "No state mentioned" is not
  "probably fine."
- **Beware official-records SEO clones.** Sites mimicking court/records portals
  (unofficial domains stuffed with the state name and "records" or "case search")
  often outrank the real portal. The record itself lives on a government domain;
  anything else is at best `secondary`, at worst a scam — verify the official
  portal's true domain from the court or agency's own site.
- Apply jurisdiction checks to **API responses too**, not just web pages — federated
  catalogs (Socrata especially) can return another city's datasets mixed into a
  state portal's results.

## 4. Test live, then explain

For each promising dataset: fetch it. Confirm the ZIP or jurisdiction is actually
covered, confirm it updates (look at the newest record's date), and note the access
shape (API endpoint, CSV, RSS, HTML page). A 200 with zero rows where rows are
expected is a failure, not a pass. Field-tested refinements:

- **One plausible row is not coverage — check the volume.** A wrong-jurisdiction
  dataset can still return a stray plausible-looking row for your area (a
  city-limits dataset returning one licensed address just outside them). Run a
  count query and ask: is this volume plausible for the whole town? A dataset that
  "covers" a village of 13,000 with 3 rows does not cover it. Confirm the
  jurisdiction of the *dataset*, not just the portal it sits on.
- **County datasets often need a crosswalk.** County data is frequently keyed by
  township, parcel ID, or district — not municipality or ZIP. When the dataset has
  no town/ZIP column, look for the portal's parcel-universe or geography crosswalk
  dataset and plan a **two-step adapter** (crosswalk → IDs → filter the target
  dataset by ID). Record the crosswalk as part of the source entry.
- **Bot-blocked is not dead.** Live, current, useful government sources sometimes
  return 403 to non-browser clients. Classify these `manual-only` (weekly human or
  browser-automation lookup) rather than failing them — and say so in the registry
  so nobody later "discovers" the source is broken.
- **Ask what the source retains.** Some sources keep only a few weeks of history
  (a police blotter retaining 4 weeks, for example). If history evaporates, the
  newsletter must archive every issue's pull — record the retention window and
  flag `archive-on-run` in the registry entry.
- **A stale official page usually means a platform migration, not a dead source.**
  An agenda archive that stops eighteen months ago has probably moved to a new
  vendor system. Search for the successor before marking the source dead — and log
  the stale predecessor so nobody re-registers it.

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
  the interview seed the narrative tiers. For each entry also record: **access
  shape** (API / CSV / RSS / scrape / manual-only), **retention window** (and
  `archive-on-run` if the source deletes its own history), and **how jurisdiction
  was confirmed**. Institutional names rot — school districts reorganize, agencies
  merge, vendors change — so registry entries naming an institution should be
  **re-verified quarterly** (the same 8th-edition review that updates scores).
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
