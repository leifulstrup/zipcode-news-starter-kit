// Single loader for the kit's three config files. Every script imports from here;
// nothing else reads site.config.json, config/sources.json, or config/privacy.json
// directly. Two tools with two readings of the same config is the class of bug this
// file exists to prevent (see docs/CONTRACT.md).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// bin/lib/ -> repo root. Never use import.meta.url.pathname: the path may contain spaces.
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(rel) {
  const path = join(ROOT, rel);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`[config] cannot read ${rel}: ${err.message}`);
    console.error(`[config] run /setup (or copy the template from docs/CONTRACT.md §2-4) before running this script.`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[config] ${rel} is not valid JSON: ${err.message}`);
    process.exit(2);
  }
}

export function loadConfig() {
  const cfg = readJson('site.config.json');
  for (const key of ['zip', 'siteName', 'timezone', 'workerName', 'cronUtc', 'sections', 'colors']) {
    if (cfg[key] === undefined) {
      console.error(`[config] site.config.json is missing required key "${key}" — see docs/CONTRACT.md §2.`);
      process.exit(2);
    }
  }
  return cfg;
}

export function loadSources() {
  const src = readJson('config/sources.json');
  for (const key of ['self', 'primary', 'interestedPrimary', 'secondary', 'noVintage', 'officialIncident', 'adjacentJurisdictions']) {
    if (!Array.isArray(src[key])) {
      console.error(`[config] config/sources.json key "${key}" must be an array — see docs/CONTRACT.md §3.`);
      process.exit(2);
    }
  }
  return src;
}

export function loadPrivacy() {
  const priv = readJson('config/privacy.json');
  for (const key of ['publisherNames', 'blockedEmails', 'allowedEmails', 'streetMarkers', 'coordinatePrefixes', 'extraPatterns']) {
    if (!Array.isArray(priv[key])) {
      console.error(`[config] config/privacy.json key "${key}" must be an array — see docs/CONTRACT.md §4.`);
      process.exit(2);
    }
  }
  return priv;
}

// Daily-digest settings with defaults. The `daily` block is OPTIONAL in
// site.config.json (instances configured before v0.5 don't have it), so this
// helper is the single place the defaults live — scripts must never reach into
// cfg.daily directly.
export function loadDaily(cfg) {
  const d = cfg.daily || {};
  const daily = {
    enabled: d.enabled === true,
    deliverTo: typeof d.deliverTo === 'string' ? d.deliverTo : '',
    sendQuietDays: d.sendQuietDays === true,
    hourUtc: Number.isInteger(d.hourUtc) ? d.hourUtc : 13,
    model: typeof d.model === 'string' && d.model ? d.model : 'claude-haiku-4-5-20251001',
    maxItems: Number.isInteger(d.maxItems) && d.maxItems > 0 ? d.maxItems : 12,
  };
  if (daily.enabled && !daily.deliverTo) {
    console.error('[config] daily.enabled is true but daily.deliverTo is empty — the digest');
    console.error('[config] is a send-to-SELF radar and needs the publisher\'s own address.');
    console.error('[config] Run /enable-daily, or set daily.deliverTo in site.config.json.');
    process.exit(2);
  }
  return daily;
}

// RSS/Atom feeds for the daily digest. config/feeds.json is optional (empty
// list if absent) — feeds only enter via /find-sources or /enable-daily, with
// the publisher's approval, like every other source.
export function loadFeeds() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, 'config/feeds.json'), 'utf8');
  } catch {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[config] config/feeds.json is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  if (!Array.isArray(parsed.feeds)) {
    console.error('[config] config/feeds.json must be { "feeds": [...] } — see docs/CONTRACT.md §10.');
    process.exit(2);
  }
  for (const f of parsed.feeds) {
    if (!f.name || !f.url) {
      console.error('[config] every entry in config/feeds.json needs "name" and "url".');
      process.exit(2);
    }
  }
  return parsed.feeds;
}

// The display name, with the experimental label applied per the accuracy-log rule.
export function displayName(cfg) {
  return cfg.experimental ? `${cfg.siteName} (Experimental)` : cfg.siteName;
}

// Canonical site origin: custom domain if set, else the free workers.dev host.
// The workers.dev account slug is unknowable from config alone, so an explicit
// domain of "" yields a relative-origin build ('' → root-relative URLs) and the
// smoke test takes --base at runtime.
export function siteOrigin(cfg) {
  return cfg.domain ? `https://${cfg.domain}` : '';
}
