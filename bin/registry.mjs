// registry — read (and prepare contributions to) the shared, community-vetted
// source registry.
//
//   node bin/registry.mjs lookup [--state XX] [--county FIPS] [--place FIPS]
//                                [--category X] [--json] [--offline]
//   node bin/registry.mjs search <term> [--state XX] [--json] [--offline]
//   node bin/registry.mjs export [--date YYYY-MM-DD]
//   node bin/registry.mjs --help
//
// WHY THIS EXISTS
// Source discovery costs every publisher 30–60 minutes of agent research, and
// most of that work is duplicated: every instance in a county independently
// rediscovers the sheriff's incident feed, the assessor, the courts. Worse, the
// expensive part is not the URL — it is the traps. That a name column is
// space-padded so equality filters return zero rows with HTTP 200, that a
// portal's `updatedAt` reflects file touches rather than new data, that a feed
// runs 24 days behind: each of those cost somebody a near-miss or a wrong
// figure. The registry carries those forward.
//
// THE STANDING RULE, enforced socially rather than in code because it is a
// judgement: **the registry is leads, not authority.** An entry is exactly as
// authoritative as a promising search result. It is still live-tested, its
// jurisdiction is still confirmed, and it still requires the publisher's
// explicit approval before it enters config/sources.json. A shared registry
// that publishers trusted blindly would propagate one instance's mistake to
// every instance, which is strictly worse than everyone searching alone.
//
// The kit works completely without this. A missing registry, a 404, a dead
// network — all degrade to "carry on with the normal sweep" and exit 0. Nothing
// here is on the publishing path.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadConfig, loadSources } from './lib/config.mjs';
import { parse, serialize } from './lib/csv.mjs';

// The column order IS the contract (docs/CONTRACT.md §11). Registry files are
// diffed in pull requests; a reordered column would make every row look changed.
//
// Schema v2. Two columns carry most of the value and deserve their rationale:
//
// `platform` — the PRODUCT behind the source (Socrata, Accela, Legistar,
// CivicClerk...), distinct from `api_type`, which is only the access shape.
// It earns its column because vendor behaviour transfers where a URL cannot:
// an Accela permit portal behaves like every other Accela permit portal, so
// knowing the platform predicts the API shape, the pagination, and half the
// traps BEFORE the first fetch — in a county nobody has registered yet.
//
// `insights` vs `traps` — deliberately separate columns for separate readers.
// A TRAP breaks your code or silently returns wrong rows: padded fields,
// lying `updatedAt`, equality filters returning zero with HTTP 200. That is an
// adapter-author's concern. An INSIGHT changes how you should WRITE about the
// number: what it actually measures versus what it appears to measure, its
// denominator, its known biases. That is an editor's concern. Collapsing them
// would bury the editorial warning inside a list of parsing gotchas.
export const COLUMNS = [
  'source_id', 'scope_type', 'state', 'county_fips', 'place_fips', 'jurisdiction',
  'category', 'name', 'url', 'platform', 'api_type', 'geo_filter', 'source_class',
  'status', 'update_cadence', 'lag_days', 'data_maturity', 'history_start',
  'retention', 'quality', 'last_verified', 'kit_version', 'traps', 'insights', 'notes',
];

// A row is usable only with these. Everything else may be blank — a contributor
// records what they actually verified, and blank means UNKNOWN, never a default.
// A guessed cadence is worse than an empty one: it looks like evidence.
export const REQUIRED = [
  'source_id', 'scope_type', 'state', 'jurisdiction', 'category', 'name', 'url',
  'source_class', 'status', 'last_verified', 'kit_version',
];

// file:// is accepted so the client is testable offline against a fixture, the
// same reason bin/daily-delta.mjs accepts it. Also lets an organization point
// instances at an internal mirror without forking the kit.
const BASE = (process.env.REGISTRY_BASE_URL ||
  'https://raw.githubusercontent.com/leifulstrup/zipcode-news-source-registry/main/data')
  .replace(/\/+$/, '');

const CACHE_DIR = join(ROOT, 'data', 'registry-cache');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;   // a day; the registry moves slowly
const STALE_DAYS = 180;                          // re-verify anything older

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1]; };
const has = (name) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) =>
  !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && flagTakesValue(argv[i - 1])));

function flagTakesValue(f) {
  return ['--state', '--county', '--place', '--category', '--date'].includes(f);
}

if (has('help') || argv[0] === 'help' || argv[0] === '-h') { help(); process.exit(0); }

const cmd = positional[0] || 'lookup';

/* ------------------------------------------------------------------ help --- */
function help() {
  console.log(`
registry — the shared, community-vetted source registry

  node bin/registry.mjs lookup                 what has already been vetted for your area
  node bin/registry.mjs search <term>          reverse lookup: who else uses this host/source
  node bin/registry.mjs export                 CSV rows for YOUR approved sources, to contribute
  node bin/registry.mjs --help

Flags
  --state XX        2-letter state code           (default: site.config.json stateCode)
  --county FIPS     5-digit county FIPS           (default: site.config.json countyFips)
  --place FIPS      7-digit place FIPS            (default: site.config.json placeFips)
  --category NAME   filter to one category (crime, permits, assessor, courts, ...)
  --json            machine-readable output
  --offline         use the local cache only, never the network
  --date YYYY-MM-DD export only: the verification date to stamp (default: today)

The registry is LEADS, NOT AUTHORITY. Every entry is still live-tested, its
jurisdiction still confirmed, and it still needs your approval before it enters
config/sources.json — exactly like a search result. See docs/SHARED-REGISTRY.md.

Registry source: ${BASE}
`.trim());
}

/* ------------------------------------------------------- jurisdiction ------ */
function jurisdiction() {
  const cfg = loadConfig();
  return {
    cfg,
    state: (flag('state') || cfg.stateCode || '').toUpperCase(),
    county: flag('county') || cfg.countyFips || '',
    place: flag('place') || cfg.placeFips || '',
  };
}

/* ------------------------------------------------------------- fetching ---- */
async function fetchState(state, { offline }) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `${state}.csv`);
  const stampPath = join(CACHE_DIR, `${state}.fetched`);

  const cacheAge = existsSync(cachePath) ? Date.now() - statSync(cachePath).mtimeMs : Infinity;
  const cacheFresh = cacheAge < CACHE_MAX_AGE_MS;

  if (offline || cacheFresh) {
    if (existsSync(cachePath)) {
      const when = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : 'unknown';
      console.error(`registry: using cached ${state}.csv (fetched ${when})`);
      return parse(readFileSync(cachePath, 'utf8'));
    }
    if (offline) {
      console.error(`registry: --offline and no cached copy of ${state}.csv. Run once without --offline.`);
      return null;
    }
  }

  const url = `${BASE}/${state}.csv`;
  try {
    let text;
    if (url.startsWith('file://')) {
      text = readFileSync(new URL(url), 'utf8');
    } else {
      const res = await fetch(url, {
        headers: { 'user-agent': 'zipcode-news-starter-kit registry client' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) {
        console.error(`registry: no entries for ${state} yet (404 at ${url}).`);
        console.error('registry: that is not a failure — the registry is a shared bonus, not a dependency.');
        console.error('registry: run the normal /find-sources sweep, then contribute what you vet:');
        console.error('registry:   node bin/registry.mjs export');
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    }
    writeFileSync(cachePath, text);
    writeFileSync(stampPath, new Date().toISOString());
    return parse(text);
  } catch (err) {
    // Never block a publisher because a CDN hiccuped.
    console.error(`registry: could not fetch ${url} (${err.message}).`);
    if (existsSync(cachePath)) {
      console.error('registry: falling back to the cached copy.');
      return parse(readFileSync(cachePath, 'utf8'));
    }
    console.error('registry: no cache available — continuing without the registry. The kit works fine without it.');
    return null;
  }
}

/* -------------------------------------------------------------- display --- */
function daysSince(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  return Math.round((Date.now() - Date.parse(`${iso}T12:00:00Z`)) / 86400000);
}

function markers(row) {
  const out = [];
  const age = daysSince(row.last_verified);
  if (age === null) out.push('[NO VERIFY DATE]');
  else if (age > STALE_DAYS) out.push(`[STALE — ${age}d since verified: RE-VERIFY]`);
  if (row.status && row.status !== 'live') out.push(`[STATUS: ${row.status.toUpperCase()}]`);
  return out.join(' ');
}

function printRows(rows) {
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  }
  for (const [cat, list] of [...byCategory.entries()].sort()) {
    // Newest verification first: the freshest evidence leads.
    list.sort((a, b) => (b.last_verified || '').localeCompare(a.last_verified || ''));
    console.log(`\n${cat.toUpperCase()}`);
    for (const r of list) {
      const mark = markers(r);
      console.log(`  ${r.name}${mark ? '  ' + mark : ''}`);
      console.log(`    ${r.url}`);
      console.log(`    ${r.jurisdiction} · class ${r.source_class} · verified ${r.last_verified || '?'}${r.kit_version ? ` (kit ${r.kit_version})` : ''}`);

      // Decision-relevant at a glance: what it runs on, how to reach it, how to
      // narrow it to a ZIP, how good it is. Blank fields are omitted rather than
      // printed as "unknown" — absence is the honest signal.
      const tech = [
        r.platform && r.platform !== 'unknown' ? `platform ${r.platform}` : null,
        r.api_type ? `api ${r.api_type}` : null,
        r.geo_filter ? `geo ${r.geo_filter}` : null,
        r.quality ? `quality ${r.quality}` : null,
      ].filter(Boolean);
      if (tech.length) console.log(`    ${tech.join(' · ')}`);

      // The data-character line: how fresh, how settled, how far back, how much
      // it keeps. Every one of these changes what you may claim from the number.
      const character = [
        r.update_cadence && r.update_cadence !== 'unknown' ? `updates ${r.update_cadence}` : null,
        r.lag_days !== '' && r.lag_days != null ? `lag ~${r.lag_days}d` : null,
        r.data_maturity && r.data_maturity !== 'unknown' ? `${r.data_maturity} figures` : null,
        r.history_start ? `history from ${r.history_start}` : null,
        r.retention ? `retains ${r.retention}` : null,
      ].filter(Boolean);
      if (character.length) console.log(`    ${character.join(' · ')}`);

      // Retention that discards history is an operational instruction, not a
      // footnote: if the source drops it, only your archive will have it.
      if (r.retention && !/^full$/i.test(r.retention)) {
        console.log(`    ARCHIVE ON EVERY RUN — this source keeps only ${r.retention}; history it drops is gone unless you kept it.`);
      }
      // A lagging source cannot answer "this week" (adapters README §9).
      if (r.lag_days && Number(r.lag_days) >= 7) {
        console.log(`    LAG: ~${r.lag_days} days behind — a nominal "this week" window may be empty or partial. Name the window the data actually covers.`);
      }
      if (r.data_maturity === 'preliminary') {
        console.log(`    PRELIMINARY: figures get reclassified after publication. Write "reported", never a settled count.`);
      }

      for (const t of (r.traps || '').split(';').map(s => s.trim()).filter(Boolean)) {
        console.log(`    TRAP: ${t}`);
      }
      // Insights print in full and unsplit — they are prose about what the data
      // means, and the reason to read the row at all.
      if (r.insights) console.log(`    INSIGHT: ${r.insights}`);
      if (r.notes) console.log(`    ${r.notes}`);
    }
  }
}

/* --------------------------------------------------------------- lookup --- */
async function lookup() {
  const { cfg, state, county, place } = jurisdiction();

  if (!state) {
    console.log('registry: this instance has no `stateCode` in site.config.json, so there is');
    console.log('registry: nothing to look up yet. /setup records stateCode, countyFips and');
    console.log('registry: placeFips for your ZIP; they are what let the kit reuse sources');
    console.log('registry: other publishers in your county have already vetted.');
    console.log('');
    console.log('registry: to try it anyway:  node bin/registry.mjs lookup --state CA --county 06037');
    console.log('registry: the kit works completely without the registry — see docs/SHARED-REGISTRY.md.');
    return 0;   // absence of config is not an error
  }

  const rows = await fetchState(state, { offline: has('offline') });
  if (!rows) return 0;

  const category = flag('category');
  // A ZIP is served by its state, its county, and (if incorporated) its place.
  // Region-scoped rows (transit districts, metro agencies) are included when
  // they name the county, since that is the only handle a CSV row has on them.
  const matched = rows.filter(r => {
    if (r.state && r.state.toUpperCase() !== state) return false;
    if (category && r.category !== category) return false;
    if (r.scope_type === 'state') return true;
    if (county && r.county_fips === county) return true;
    if (place && r.place_fips === place) return true;
    return false;
  });

  if (has('json')) {
    console.log(JSON.stringify({ state, county, place, count: matched.length, sources: matched }, null, 2));
    return 0;
  }

  console.log(`\nregistry — vetted sources for ${cfg.city || state}${county ? ` (county ${county}` : ''}${place ? `, place ${place}` : county ? '' : ''}${county ? ')' : ''}`);
  console.log(`${matched.length} of ${rows.length} ${state} entries match this jurisdiction.`);

  if (!matched.length) {
    console.log('\nNothing registered for your area yet. Run the normal /find-sources sweep —');
    console.log('and please contribute what you vet:  node bin/registry.mjs export');
    return 0;
  }

  printRows(matched);

  const stale = matched.filter(r => (daysSince(r.last_verified) ?? 1e9) > STALE_DAYS).length;
  console.log(`\nLEADS, NOT AUTHORITY: every entry above is still live-tested, its jurisdiction`);
  console.log(`still confirmed, and still needs your approval before it enters config/sources.json.`);
  console.log(`Treat these exactly like promising search results — the traps are the real payload.`);
  if (stale) console.log(`${stale} entr${stale === 1 ? 'y is' : 'ies are'} over ${STALE_DAYS} days old: re-verify, then refresh the date when you contribute.`);
  return 0;
}

/* --------------------------------------------------------------- search --- */
async function search() {
  const term = positional[1];
  if (!term) {
    console.error('registry: search needs a term, e.g. `node bin/registry.mjs search sheriff`');
    return 2;
  }
  const { state } = jurisdiction();
  if (!state) {
    console.error('registry: search needs a state — set stateCode in site.config.json or pass --state XX.');
    return 0;
  }
  const rows = await fetchState(state, { offline: has('offline') });
  if (!rows) return 0;

  // Matching `platform` too makes "which other jurisdictions run Accela, and
  // what did they learn?" answerable — vendor knowledge transfers where a URL
  // does not. `insights` is searchable for the same reason.
  const needle = term.toLowerCase();
  const matched = rows.filter(r =>
    [r.name, r.url, r.notes, r.jurisdiction, r.source_id, r.platform, r.insights]
      .some(v => (v || '').toLowerCase().includes(needle)));

  if (has('json')) {
    console.log(JSON.stringify({ state, term, count: matched.length, sources: matched }, null, 2));
    return 0;
  }

  console.log(`\nregistry — ${matched.length} ${state} entr${matched.length === 1 ? 'y' : 'ies'} matching "${term}"`);
  if (!matched.length) {
    console.log('Nothing found. If you vet it yourself, contribute it: node bin/registry.mjs export');
    return 0;
  }
  printRows(matched);
  console.log('\nReverse lookup shows which jurisdictions already rely on a source and what');
  console.log('they learned about it. Still leads, not authority — live-test before you adopt.');
  return 0;
}

/* --------------------------------------------------------------- export --- */
async function export_() {
  const cfg = loadConfig();
  const src = loadSources();
  const date = flag('date') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`registry: --date must be YYYY-MM-DD, got "${date}"`);
    return 2;
  }
  const kitVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

  const state = (cfg.stateCode || '').toUpperCase();
  const county = cfg.countyFips || '';
  const place = cfg.placeFips || '';
  if (!state) {
    console.error('registry: export needs `stateCode` in site.config.json (and ideally countyFips).');
    console.error('registry: /setup records these; without them a contributed row cannot be filed.');
    return 2;
  }

  // Only hosts the publisher actually classified. Deliberately conservative:
  // the registry records public facts about public data sources, and an
  // over-eager exporter is how private notes leak into a public repo.
  // What the instance actually KNOWS gets filled; everything else stays blank.
  // Adapters are the honest source of cadence/lag/maturity for the hosts they
  // query, because those values were observed during real fetches. A blank cell
  // means "not verified", which is information; a defaulted cell is a guess
  // wearing the costume of evidence.
  const adapterFacts = new Map();   // host -> partial row
  try {
    const { adapters } = await import('./adapters/index.mjs');
    for (const a of adapters) {
      const host = (a.host || a.registryHost || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!host) continue;
      adapterFacts.set(host, {
        platform: a.platform || '',
        api_type: a.apiType || '',
        geo_filter: a.geoFilter || '',
        update_cadence: a.updateCadence || '',
        lag_days: a.lagDays != null ? String(a.lagDays) : '',
        data_maturity: a.dataMaturity || '',
        history_start: a.historyStart || '',
        retention: a.retention || '',
        category: a.category || '',
      });
    }
  } catch { /* no adapters, or none exporting metadata — blanks are correct */ }

  const classes = [
    ['primary', src.primary], ['interestedPrimary', src.interestedPrimary], ['secondary', src.secondary],
  ];
  const rows = [];
  for (const [cls, hosts] of classes) {
    for (const host of hosts) {
      const known = adapterFacts.get(host) || {};
      rows.push({
        source_id: `${state.toLowerCase()}-${county || 'state'}-${host.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`,
        scope_type: county ? 'county' : 'state',
        state,
        county_fips: county,
        place_fips: place,
        jurisdiction: [cfg.city, cfg.state].filter(Boolean).join(', '),
        category: known.category || '',
        name: host,
        url: `https://${host}/`,
        platform: known.platform || '',
        api_type: known.api_type || '',
        geo_filter: known.geo_filter || '',
        source_class: cls,
        status: 'live',
        update_cadence: known.update_cadence || '',
        lag_days: known.lag_days || '',
        data_maturity: known.data_maturity || '',
        history_start: known.history_start || '',
        retention: known.retention || '',
        quality: '',
        last_verified: date,
        kit_version: kitVersion,
        traps: '',
        insights: '',
        notes: '',
      });
    }
  }

  if (!rows.length) {
    console.error('registry: no classified sources in config/sources.json yet — nothing to export.');
    console.error('registry: run /find-sources first.');
    return 0;
  }

  rows.sort((a, b) =>
    (a.county_fips || '').localeCompare(b.county_fips || '') ||
    (a.place_fips || '').localeCompare(b.place_fips || '') ||
    (a.category || '').localeCompare(b.category || '') ||
    a.source_id.localeCompare(b.source_id));

  process.stdout.write(serialize(COLUMNS, rows));

  console.error('');
  console.error('─────────────────────────────────────────────────────────────────────────');
  console.error(`${rows.length} row(s) above, from the hosts you classified in config/sources.json.`);
  console.error('');
  console.error('BEFORE YOU SUBMIT — read every row yourself:');
  console.error('  1. Blank cells mean UNKNOWN, and that is honest. Fill in what you VERIFIED');
  console.error('     this session; never guess. A guessed cadence looks like evidence.');
  console.error('  2. `platform` is high-value and easy: Socrata, ArcGIS, Accela, Legistar,');
  console.error('     CivicClerk, Granicus, Tyler... Vendor behaviour repeats across');
  console.error('     jurisdictions, so it helps a publisher in a county nobody has registered.');
  console.error('  3. `traps` break CODE (padded fields, lying updatedAt, filters that return 0');
  console.error('     rows with HTTP 200). `insights` change WRITING (what the number actually');
  console.error('     measures, its denominator, its biases). Both are worth more than the URL.');
  console.error('  4. `update_cadence`, `lag_days`, `data_maturity`, `retention` — you observed');
  console.error('     these during live testing; capturing them now costs nothing and is');
  console.error('     expensive to reconstruct later.');
  console.error('  5. `url` is guessed from the hostname. Point it at the actual dataset or page.');
  console.error('  6. PRIVACY: this becomes PUBLIC. It must contain only facts about public data');
  console.error('     sources — never your name, address, email, coordinates, or anything from');
  console.error('     config/privacy.json. Nothing about you belongs in this file.');
  console.error('');
  console.error('Then open a pull request against the registry repo. Contribution is never');
  console.error('automatic and never happens without you reading the rows first.');
  console.error('─────────────────────────────────────────────────────────────────────────');
  return 0;
}

/* ----------------------------------------------------------------- main --- */
let code = 0;
if (cmd === 'lookup') code = await lookup();
else if (cmd === 'search') code = await search();
else if (cmd === 'export') code = await export_();
else {
  console.error(`registry: unknown command "${cmd}"`);
  help();
  code = 2;
}
process.exit(code);
