# The shared source registry

Working out what a county actually publishes — which portal is real, which
dataset covers your ZIP, which field is padded, how far behind the feed runs —
is the single most expensive step in this kit. It costs an agent 30–60 minutes
of research per instance, and in a place like Los Angeles County it is genuinely
hard: dozens of overlapping jurisdictions, a city portal that is the wrong
jurisdiction for most of the county's residents, and datasets whose geography
fields range from a clean `zip_code` column to nothing at all.

And almost all of that work is **duplicated**. LA County has roughly 250 ZIP
codes. If ten publishers there each run `/find-sources`, they each independently
rediscover the Sheriff's incident data, the assessor's parcel roll, the recorder,
the courts — and each independently steps on the same traps. Nothing carries
forward.

The shared registry fixes that: a public, community-maintained table of vetted
sources that a new instance reads *before* it starts searching, so publisher
N+1 begins from what publishers 1..N already established.

## The key design decision: jurisdiction, not ZIP

The obvious schema — ZIP → sources — is the wrong one. Sources are almost never
ZIP-scoped. The Sheriff serves ~90 cities; the assessor covers the whole county;
the state judiciary covers everything. A ZIP-keyed table would store the same
county's sources hundreds of times, and every correction would need hundreds of
edits.

So the registry is keyed on **jurisdiction** — state, county FIPS, place FIPS —
and each instance resolves its own ZIP to those codes **once**, at `/setup`,
storing `stateCode`, `countyFips`, `placeFips` in `site.config.json`. Lookup is
then a filter, not a join against a giant crosswalk.

Three things fall out of that choice for free:

- **The table is ~100× smaller.** One row per source per jurisdiction, not per
  ZIP.
- **Reverse lookup is trivial.** "Who else uses this host?" is a substring
  search over the same file — no second index (`bin/registry.mjs search`).
- **A correction lands once** and every publisher in the county gets it.

## What a row carries — and why the traps matter most

```
source_id,scope_type,state,county_fips,place_fips,jurisdiction,category,name,
url,api_type,geo_filter,source_class,status,last_verified,kit_version,traps,notes
```

The URL is the least valuable column. Anyone can find a portal. What cannot be
found by searching, and what costs hours to learn, is in `geo_filter`, `traps`,
and `status`:

- `geo_filter` — how you actually narrow this dataset to a ZIP: a field name, or
  the technique (`point-in-polygon`, `district-crosswalk`) when there is no
  geography column. This is the single hardest thing to work out per dataset.
- `traps` — the scars. "area_name is space-padded; equality filters return zero
  with HTTP 200 — use the district ID." "Portal `updatedAt` reflects file
  touches, not new data; query `max(date_field)`." "Runs 24 days behind; a
  nominal weekly window is always empty."
- `status` — `live` / `degraded` / `manual-only` (alive but 403s to
  non-browser clients) / `dead`. Knowing a source is *bot-blocked rather than
  dead* saves a publisher from deleting a good source.

`source_class` maps straight onto `config/sources.json` (primary /
interestedPrimary / secondary), so an approved import needs no re-classification.

## The rule that keeps it safe: leads, not authority

The registry is subject to exactly the rule this publication applies to its own
readers. **An entry is a lead, not a finding.** Importing one does not adopt it:

1. Every imported source is still **live-tested** locally — fetched, checked
   that it really covers this ZIP, checked that it still updates.
2. Every source still requires the **publisher's explicit approval** before it
   enters `config/sources.json`. Unchanged from day one.
3. Every source, adopted or rejected, still gets a `data/source-log.md` entry
   with the verdict.

The registry saves the *discovery* cost. It never saves the *verification* cost,
because verification is the thing that makes the publication trustworthy.

That rule is also the answer to the obvious attack: a poisoned entry is worth no
more than a poisoned search result, because both must survive a live test and a
human's approval before anything is published. Two further boundaries:

- The registry carries **data, never code**. It records that a Socrata dataset
  exists and how to filter it; the local agent writes the adapter. Shipping
  adapter code through a shared channel would be a supply-chain risk with no
  compensating benefit.
- Contributions carry **no contributor identity** — no names, no emails, no
  coordinates, no instance URLs. `kit_version` records what verified a row, not
  who. The rows are public-record facts about public data sources, and nothing
  else. `bin/registry.mjs export` enforces this and tells you to read every row
  before submitting.

## Staleness is a first-class field

Sources rot: portals migrate, agencies reorganize, datasets freeze. So
`last_verified` is mandatory, and the client marks anything older than **180
days** as stale — a lead that needs re-verification rather than a fact. When a
publisher re-verifies a stale row, refreshing its date is a one-line
contribution that helps everyone behind them. A registry that pretended
freshness would be worse than no registry, for the same reason a portal's lying
`updatedAt` field is worse than no timestamp.

## How big does this get, and what does it cost to host?

Concretely:

| Scenario | Rows | Size |
|---|---|---|
| Realistic near term | 50–500 | 15–150 KB |
| Every US county, ~10 sources each | ~31,000 | ~8 MB |
| Saturation: counties + ~19,500 places | ~130,000 | ~35 MB |

Split one file per state (`data/CA.csv`), the largest state file at saturation
is a few MB — far under GitHub's 50 MB soft warning, and an instance only ever
fetches its own state. Rows sorted by `(county_fips, place_fips, category,
source_id)` keep diffs clean and merge conflicts rare, since contributors from
different counties never touch the same lines.

**Hosting cost: zero.** A public GitHub repo, fetched raw over the CDN,
contributed to by pull request. No server, no database, no auth, no ongoing
spend — and the kit caches its state file locally for 24 hours, so normal
operation makes no network call at all. If it ever outgrows that (it will not),
the same CSVs drop onto any static host unchanged.

## On the "ledger" framing

The instinct that this should be an append-only, collectively-built, verifiable
record is right — but **git already is that ledger**, and it is a better fit
than a blockchain here. It gives append-only history, cryptographic integrity of
every revision, full provenance for any row (`git log -S` finds who changed a
value and when), and — the part a trustless system specifically cannot offer —
**human review before a change lands**. The scarce resource in this problem is
not consensus among strangers; it is judgment about whether a source is real and
what its traps are. Pull requests are the right primitive for that, and they
cost nothing to run.

## Using it

```
node bin/registry.mjs lookup            # what's already vetted for my jurisdiction
node bin/registry.mjs search <term>     # reverse lookup: who else uses this host
node bin/registry.mjs export            # emit my approved sources as rows to contribute
```

Contributing back is `/contribute-sources`: it exports this instance's approved
rows, reads each one to the publisher in plain language, re-verifies staleness,
then forks, validates and opens the pull request — with the publisher approving
before anything becomes public. The registry also accepts an **issue** instead of
a PR, which is the right path for anyone who would rather their GitHub account
not be publicly associated with a particular ZIP code.

`/find-sources` runs the lookup before its own sweep and presents hits as
candidates — with their traps and verification dates — then searches only for
what the registry did not cover. `/add-source` checks the registry when vetting
a proposal, since it may already be known. Both offer to contribute back at the
end.

The kit works completely without the registry: if the repo is unreachable or
does not exist, the client says so plainly and the normal sweep proceeds. A
shared cache is an accelerator, never a dependency.
