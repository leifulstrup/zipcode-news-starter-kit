// The deterministic half of the daily digest: collect what is GENUINELY NEW
// since the last run, with no model involved. The model (if it runs at all)
// only summarizes what this script collected — so a quiet day costs nothing,
// and nothing can appear in the digest that this script didn't see.
//
//   node bin/daily-delta.mjs [--date YYYY-MM-DD]
//
// Sources of delta:
//   - RSS/Atom feeds in config/feeds.json  → items whose link/guid was never seen
//   - adapters marked `daily: true`        → changed leaf values vs the last run
//
// State lives in data/daily/state.json. First run ever records a baseline and
// reports quiet (plus a 3-item starter sample) — dumping a feed's whole history
// as "new" on day one would be a lie about novelty.
//
// Always exits 0: an empty or failed day is information, not a crash. The
// workflow reads the `quiet` flag from the output JSON to decide whether the
// model step (and the email) happen at all.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadConfig, loadDaily, loadFeeds } from './lib/config.mjs';

const cfg = loadConfig();
const daily = loadDaily(cfg);
const feeds = loadFeeds();

const args = process.argv.slice(2);
const dateIdx = args.indexOf('--date');
const date = dateIdx !== -1 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`daily-delta: --date must be YYYY-MM-DD, got "${date}"`);
  process.exit(2);
}

const DAILY_DIR = join(ROOT, 'data', 'daily');
const STATE_PATH = join(DAILY_DIR, 'state.json');
const PER_FEED_CAP = 5;      // headlines per feed per day; the rest becomes a count
const SEEN_CAP = 500;        // rolling window of remembered item keys per feed

mkdirSync(DAILY_DIR, { recursive: true });

let state = { feeds: {}, adapterBlocks: {}, lastRun: null };
let firstRun = true;
if (existsSync(STATE_PATH)) {
  try {
    state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    firstRun = false;
  } catch {
    console.error('daily-delta: state.json is corrupt — re-baselining (this run reports quiet).');
  }
}

const items = [];
const errors = [];

/* ---------- fetching (file:// supported so the delta logic is testable
   offline — fixture feeds in tests are local files, and fetch() cannot read
   them on all runtimes) ---------- */
async function fetchText(url) {
  if (url.startsWith('file://')) {
    return readFileSync(new URL(url), 'utf8');
  }
  const res = await fetch(url, {
    headers: { 'user-agent': 'zipcode-news-daily-delta (private publisher radar)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/* ---------- tolerant, dependency-free RSS/Atom item extraction.
   CAVEAT (documented in docs/DAILY-DIGEST.md): this is regex parsing, not a
   real XML parser. It handles the common shapes of RSS 2.0 <item> and Atom
   <entry>; a feed with exotic namespacing may parse partially. The failure
   mode is a missed or duplicated headline in a private email — acceptable
   here, never acceptable in the public issue, which is why the weekly
   pipeline shares none of this code. ---------- */
function pick(block, ...tags) {
  for (const tag of tags) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    if (m) return m[1].trim();
  }
  return '';
}
function unwrap(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = unwrap(pick(b, 'title'));
    // Atom links live in href attributes; RSS links are element text.
    let link = unwrap(pick(b, 'link'));
    if (!link) {
      const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (href) link = href[1].trim();
    }
    const guid = unwrap(pick(b, 'guid', 'id'));
    const when = unwrap(pick(b, 'pubDate', 'updated', 'published', 'dc:date'));
    if (title || link) out.push({ title, link, key: link || guid || title, when });
  }
  return out;
}

/* ---------- feed delta ---------- */
for (const feed of feeds) {
  let parsed;
  try {
    parsed = parseFeed(await fetchText(feed.url));
  } catch (err) {
    errors.push({ source: feed.name, url: feed.url, message: String(err.message || err) });
    continue;
  }
  const seen = new Set(state.feeds[feed.name]?.seen || []);
  const isNewFeed = !state.feeds[feed.name];
  const fresh = parsed.filter(it => it.key && !seen.has(it.key));

  if (isNewFeed || firstRun) {
    // Baseline: remember everything, surface only a small starter sample.
    for (const it of fresh.slice(0, 3)) {
      items.push({ kind: 'feed', source: feed.name, title: it.title || it.link,
        url: it.link, detail: `latest at baseline (${it.when || 'undated'}) — first run records what exists; tomorrow's digest reports only what's new` });
    }
  } else {
    for (const it of fresh.slice(0, PER_FEED_CAP)) {
      items.push({ kind: 'feed', source: feed.name, title: it.title || it.link,
        url: it.link, detail: it.when || '' });
    }
    if (fresh.length > PER_FEED_CAP) {
      items.push({ kind: 'feed', source: feed.name,
        title: `…and ${fresh.length - PER_FEED_CAP} more new items`, url: '', detail: 'capped; see the feed directly' });
    }
  }
  const keys = [...parsed.map(it => it.key), ...seen].filter(Boolean);
  state.feeds[feed.name] = { seen: [...new Set(keys)].slice(0, SEEN_CAP) };
}

/* ---------- adapter delta: generic leaf diff, adapter-agnostic ---------- */
function leafDiff(prev, next, path = '', out = []) {
  if (prev === next) return out;
  const isLeaf = v => v === null || typeof v !== 'object';
  if (isLeaf(prev) || isLeaf(next)) {
    if (String(prev) !== String(next)) out.push({ path: path || '(root)', from: prev, to: next });
    return out;
  }
  for (const k of new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])) {
    leafDiff(prev?.[k], next?.[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}

let dailyAdapters = [];
try {
  const { adapters } = await import('./adapters/index.mjs');
  dailyAdapters = adapters.filter(a => a.daily === true);
} catch (err) {
  errors.push({ source: 'adapters', url: '', message: `registry failed to load: ${err.message}` });
}
for (const a of dailyAdapters) {
  const errsBefore = errors.length;
  const ctx = {
    config: cfg, week: date,
    windowStart: new Date(Date.parse(date) - 7 * 86400e3).toISOString().slice(0, 10),
    windowEnd: date,
    addError: (source, url, message) => errors.push({ source, url, message }),
    addRule: () => {}, addNote: () => {},
  };
  let block;
  try {
    block = await a.fetch(ctx);
  } catch (err) {
    errors.push({ source: a.name, url: '', message: String(err.message || err) });
    continue;
  }
  const prev = state.adapterBlocks[a.name];
  if (prev !== undefined && !firstRun && errors.length === errsBefore) {
    for (const d of leafDiff(prev, block).slice(0, 10)) {
      items.push({ kind: 'data', source: a.name, title: `${d.path}: ${d.from} → ${d.to}`,
        url: '', detail: 'changed since the last digest run' });
    }
  }
  // Only advance the baseline on a clean fetch — diffing against a failed
  // fetch would report the recovery as a change.
  if (errors.length === errsBefore) state.adapterBlocks[a.name] = block;
}

/* ---------- write outputs ---------- */
const capped = items.slice(0, daily.maxItems);
if (items.length > capped.length) {
  capped.push({ kind: 'feed', source: 'daily-delta', url: '',
    title: `…${items.length - capped.length} further item(s) trimmed by daily.maxItems`, detail: '' });
}
const quiet = firstRun || items.length === 0;
const delta = { date, generatedAt: new Date().toISOString(), quiet, firstRun, items: capped, errors };
const outPath = join(DAILY_DIR, `${date}.json`);
writeFileSync(outPath, JSON.stringify(delta, null, 2) + '\n');
state.lastRun = { date, at: delta.generatedAt };
writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');

console.log(`daily-delta ${date}${firstRun ? ' (FIRST RUN — baseline recorded, reported quiet)' : ''}`);
console.log(`  feeds checked: ${feeds.length} · daily adapters: ${dailyAdapters.length}`);
console.log(`  new items: ${capped.length} · errors: ${errors.length} · quiet: ${quiet}`);
for (const it of capped) console.log(`    [${it.kind}] ${it.source}: ${it.title}`);
for (const e of errors) console.log(`    [error] ${e.source}: ${e.message}`);
console.log(`  wrote ${outPath.replace(ROOT + '/', '')}`);
if (feeds.length === 0 && dailyAdapters.length === 0) {
  console.log('  note: no feeds and no daily adapters are configured — every day will be');
  console.log('  quiet. Run /enable-daily (or edit config/feeds.json) to give this teeth.');
}
