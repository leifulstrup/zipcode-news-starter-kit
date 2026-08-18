# Writing a data adapter

An adapter is the deterministic script that fetches one domain of local facts —
crime, service requests, home sales, permits, dockets — before the writing model
ever runs. The governing rule of this whole kit:

> **Every time a number has to be RIGHT, fetch it — don't ask the model for it.**
> A rule that can be enforced in code should never live only in the editorial brief.

The reference publication learned this three times over: figures that were "asked
for" in the prompt shipped wrong (oldest records presented as this week's,
percentages with no denominator, 403s silently becoming "no data") until each was
moved into a fetcher. Start from a template:

- `_template-arcgis.mjs` — ArcGIS FeatureServer/MapServer portals (very common for
  city GIS: crime layers, 311, parcels, zoning)
- `_template-socrata.mjs` — Socrata portals (`data.<city>.gov` sites with SoQL)

Copy one to a real name, fill in the endpoint and fields, and it registers
itself — `index.mjs` auto-discovers every non-underscore `.mjs` file in this
directory (helper modules that are not adapters must start with `_`). Your file
must `export const adapter = { name, critical, fetch, ... }` or export it as
default. Then hold it to these rules — every one of them is a scar, not a
preference.

## 1. Null means "not retrieved" — never guess, never zero

Every value in your block is `null` unless it was actually fetched. A failed
request calls `ctx.addError(source, url, message)` and leaves the value null.
Downstream, a null tells the writing model "say this could not be sourced"; the
verify gate fails the run if errors exist and the issue admits nothing. A guessed
or defaulted value would become a permanent lie in the trend history.

## 2. Assert meaning, not status codes

A `200 OK` with zero rows where rows are expected is a **failure**, because in a
published issue it becomes "nothing happened this week" — a lie rather than a gap.
Assert what the answer should *look like*:

- the field you filter on still exists (fetch the schema, check the name);
- your ZIP/geography actually appears in the result;
- the count is plausible for your geography (a parcel query returning 12 rows for
  a ZIP with 5,000 homes means the filter broke, not that the neighborhood shrank).

Four traps confirmed in the field, each a 200 that means failure:

- **Portal metadata lies about freshness.** A catalog's `updatedAt` can reflect
  file touches, not new data — datasets have carried a current `updatedAt` while
  the newest actual record was years old. Never trust the stamp: query
  `max(<date_field>)` on the data itself.
- **Padded fields make equality filters return zero.** Government feeds
  routinely pad string columns (`'Harbor '` in a 20-char field, `'05'` for `5`),
  so `WHERE name='Harbor'` returns 0 rows with HTTP 200 — indistinguishable from
  a quiet week. Prefer `LIKE 'x%'` or a numeric/ID filter over equality on any
  name column, and cross-check every filter against an unfiltered group-by once.
- **A 200 with an empty body** is the same failure as a 200 with zero rows —
  some feeds return nothing unless a full browser User-Agent is sent.
- **Bot-blocked (403) is not dead** — classify the source manual-only rather
  than removing it.

Put these same assertions in your `probe()` hook so `bin/probe-sources.mjs` finds
a dead or renamed endpoint on Monday, not inside Friday's unattended publish run.
**Probe the trap, not just the happy path**: once you've discovered an upstream
quirk (a padded field, a lying timestamp), write a probe that asserts the quirk
still exists — if the upstream fixes it, your workaround becomes the bug, and the
probe is what tells you. And **probe your semantic assumptions, not just
liveness**: if your adapter's meaning depends on a classification (a regex over
call types, a category mapping, a code list), assert that the classification
still resolves — an upstream rename otherwise collapses your split into one
misleading total with every gate green. A probe should assert every assumption
the adapter's *meaning* depends on, not just that bytes came back. Also:
**string conventions are per-dataset, never per-agency** — the same portal has
served one dataset space-padded and its sibling unpadded; verify each dataset
independently. **Documented is not the same as working** — schema pages can tell
you a field's name but only a live query tells you which date-literal dialect
the server accepts. Probe the real service before trusting anything from it in
print. Worked examples of all four probe shapes, contributed from the first
field instance: `_reference-lag-aware.mjs` in this directory.

## 3. Distinguish "queried and empty" from "failed"

An empty result from a working query (zero open dockets this week) is a **verified
answer** the issue can print. A failed query is an admission the issue must make.
Model both explicitly — e.g. `{ available: true, open: [] }` vs. `available: false`
plus an entry in `errors[]`.

## 4. Always fetch the comparison, not just the number

A weekly count with nothing to compare it to is not a finding. Fetch the prior-year
same-period figure (bound it: `... AND date < 'same-day-last-year'`) or a trailing
baseline (90 days) in the same run. Compute deltas in the adapter, not in prose.

## 5. Small bases: put the warning in the data itself

When a prior-period base is small (< 20 or so), a percentage misleads. Emit the
caution as data the model must obey:

```js
ctx.addRule('burglary: prior-year base is 7 — report the absolute change (+3), treat the percentage as indicative only');
```

`agentRules[]` travels inside the facts file, so the instruction cannot drift away
from the numbers it governs.

## 6. Never fetch what must not be published

Omission beats scrubbing. If a dataset exposes owner names, street addresses,
parcel IDs, or coordinates, **exclude those fields from the query itself** and add
a startup check that aborts the module if they ever reappear in your field list:

```js
const FORBIDDEN = ['OWNER_NAME', 'PREMISE_ADDRESS', 'LATITUDE', 'LONGITUDE'];
const leaked = FIELDS.filter(f => FORBIDDEN.includes(f));
if (leaked.length) throw new Error(`FORBIDDEN field(s) requested: ${leaked.join(', ')}`);
```

The reference project's first live docket query returned two private residents'
personal names in a field innocently called `CASE_NAME`. **A field's name is not
its contents** — inspect a real response before shipping. And any classifier that
decides whether something is publishable must **fail closed** (unpublishable unless
positively identified as safe): the inputs that defeat a keyword classifier are the
ones carrying the least information, and those are common.

## 7. Snapshot silently-revising sources

Commercial estimate feeds (home-value indexes and the like) recompute their whole
history every release and keep no vintages. If you cite one, store the value you
saw in your block — the facts file is the only snapshot that will ever exist, and
the retrospective can only measure drift against what you recorded.

## 8. Expect the network to be flaky

Public GIS endpoints 403 or time out at random, especially on long where-clauses.
One retry with a short pause clears most of it (both templates include the
pattern). After the retry, record the error and move on — a partial facts file
with honest nulls beats a failed run.

## 9. A fetched zero is a claim — date-stamp what the data actually covers

The null-vs-error contract (§1) protects against failed fetches. It does not
protect against the subtler lie: **a query that succeeds and truly returns `0`
because the source lags.** A permits feed running a week behind returns zero
permits for "this week" every week; printed, that becomes "no permits were issued
here this week" — a fabricated statement, not a missing one. Sources with
multi-week reporting lag make a nominal weekly window *always* empty. An honest
zero and a lag zero are opposite claims, and a bare `total: 0` cannot say which
it is. Three rules, all field-tested:

- **Every count block includes `dataThrough`**: the max date actually present in
  the source (query it — §2's freshness rule), so downstream tools can see that
  "0 through Tuesday" is not "0 for the week". `bin/verify-issue.mjs` warns when
  a block reports a zero total while its `dataThrough` predates the issue week.
- **When the source lags, measure the last complete window it covers** and emit
  an `agentRule` forcing the writer to name that window ("the week of …, the
  most recent complete week in the data") instead of "this week".
- **Withhold verdicts on partial windows.** Dividing a 4.5-day count by 7 gets
  the denominator right and the comparison still wrong — many series have strong
  day-of-week composition (service requests collapse on weekends), so any
  part-week scores "quiet" on shape alone. If the window is not complete, say
  so and don't score it.

## 10. Three ways a dataset can lack your ZIP — and the right fix for each

1. **No geography field at all** (police districts, service areas): intersect
   the source's own districts against your ZIP's boundary (the Census ZCTA
   polygon) once, and filter by the resulting district list.
2. **A real ZIP column**: filter on it directly. The easy case.
3. **Address text that carries the ZIP only sporadically** — the dangerous one:
   text-matching the ZIP silently under-returns, text-matching the place name
   both under- and over-returns (real in-ZIP addresses may carry the big city's
   name), and a bounding box over-returns from neighboring areas. Geocode or
   point-in-polygon against the ZCTA boundary instead.

Standing rule: **never trust a place name or a bounding box where a boundary
test is available.**

## 11. Declare what you learned, so it can be shared

An adapter knows things about its source that took real effort to establish —
the platform, the lag, whether figures are preliminary. Declare them on the
adapter object and `bin/registry.mjs export` can carry them into the shared
registry, where the next publisher in your county starts from them instead of
rediscovering them:

```js
export const adapter = {
  name: 'permits', critical: true,
  // Optional metadata — all of it discovered during normal verification, so
  // recording it costs nothing extra and is expensive to reconstruct later.
  host: 'data.example.gov',       // matches config/sources.json classification
  platform: 'socrata',            // the PRODUCT: socrata|arcgis-hub|accela|tyler-*|…
  apiType: 'socrata',             // the ACCESS SHAPE
  category: 'permits',
  geoFilter: 'zip_code',          // or point-in-polygon | district-crosswalk | …
  updateCadence: 'daily',
  lagDays: 7,                     // the §9 lag, in one number
  dataMaturity: 'final',          // preliminary|final|revised|mixed
  historyStart: '2013',
  retention: 'full',              // or '4-weeks' → archive on every run
  async fetch(ctx) { /* … */ },
};
```

Nothing requires this and nothing breaks without it — blank means unknown, never
a default. See `docs/SHARED-REGISTRY.md` for how the registry uses it and why
`platform` is the field that transfers across jurisdictions.

## 12. The optional hooks

- `probe()` → returns `[{ name, critical, run: async () => detail }]`. Run weekly
  by `bin/probe-sources.mjs`; a critical failure blocks nothing by itself but
  opens a `source-down` issue so you fix it before Friday.
- `retrospective({ editions })` → for each past edition (`{ week, facts }`),
  re-run the printed-window queries and return
  `{ rows: [{ week, key, printed, now, delta }], errors: [] }`.
  This is the only quality check in the kit that does not depend on the judgment
  of the model that wrote the issue — it re-asks the same source the same question
  and measures how much the published number moved.
