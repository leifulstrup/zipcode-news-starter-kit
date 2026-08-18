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
