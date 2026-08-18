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

Copy one to a real name, fill in the endpoint and fields, then register it in
`index.mjs`. Then hold it to these rules — every one of them is a scar, not a
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

Put these same assertions in your `probe()` hook so `bin/probe-sources.mjs` finds
a dead or renamed endpoint on Monday, not inside Friday's unattended publish run.
**Documented is not the same as working** — schema pages can tell you a field's
name but only a live query tells you which date-literal dialect the server accepts.
Probe the real service before trusting anything from it in print.

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

## 9. The optional hooks

- `probe()` → returns `[{ name, critical, run: async () => detail }]`. Run weekly
  by `bin/probe-sources.mjs`; a critical failure blocks nothing by itself but
  opens a `source-down` issue so you fix it before Friday.
- `retrospective({ editions })` → for each past edition (`{ week, facts }`),
  re-run the printed-window queries and return
  `{ rows: [{ week, key, printed, now, delta }], errors: [] }`.
  This is the only quality check in the kit that does not depend on the judgment
  of the model that wrote the issue — it re-asks the same source the same question
  and measures how much the published number moved.
