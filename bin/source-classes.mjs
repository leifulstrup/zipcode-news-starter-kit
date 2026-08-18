/**
 * The single source of truth for how a cited host is classified.
 *
 * WHY THIS EXISTS
 * In the reference implementation this kit descends from, two tools once reported
 * different primary-source shares for the SAME issue: the rubric said 38% (below
 * target), the publication gate computed above 40% and stayed quiet. Neither was
 * wrong about its own arithmetic. They disagreed about whether civic-association
 * hosts count as primary — and a metric two tools define differently cannot be
 * trended, so the number was worthless in both directions.
 *
 * THE THIRD CATEGORY
 * That disagreement was not sloppiness; it was a real ambiguity a two-way split
 * cannot express. A neighborhood association or advisory commission IS the primary
 * record for what it said, voted or decided — and on anything contested it is a
 * participant whose membership rarely mirrors the neighborhood. Calling it primary
 * launders an interested party's framing as a neutral record; calling it secondary
 * throws away the fact that its own minutes are authoritative. So there are three
 * classes, and `interestedPrimary` is reported separately rather than folded into
 * either.
 *
 * The host lists themselves live in config/sources.json (see docs/CONTRACT.md §3)
 * and are filled in by /find-sources for YOUR area. Everything that measures
 * sourcing imports from here. If a host needs reclassifying, it changes in one
 * place — the JSON — and every tool moves together.
 */
import { loadSources } from './lib/config.mjs';

const S = loadSources();

export const hostOf = u => {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
};

// Suffix matching: `data.example.gov` matches a configured `example.gov`.
const on = (host, list) => !!host && list.some(d => host === d || host.endsWith(`.${d}`));

export const isSelf              = h => on(h, S.self);
export const isPrimary           = h => on(h, S.primary);
export const isInterestedPrimary = h => on(h, S.interestedPrimary);
export const isSecondary         = h => on(h, S.secondary);
export const isNoVintage         = h => on(h, S.noVintage);
export const isOfficialIncident  = h => on(h, S.officialIncident);
export const isAdjacent          = h => on(h, S.adjacentJurisdictions);

// Which lists are populated at all. Tools use this to distinguish "the check
// passed" from "the check is vacuous because nothing is configured yet" —
// without re-reading config/sources.json themselves (this module is its only
// reader; see docs/CONTRACT.md §3).
export const configured = {
  self: S.self.length > 0,
  primary: S.primary.length > 0,
  interestedPrimary: S.interestedPrimary.length > 0,
  secondary: S.secondary.length > 0,
  noVintage: S.noVintage.length > 0,
  officialIncident: S.officialIncident.length > 0,
  adjacentJurisdictions: S.adjacentJurisdictions.length > 0,
};

export function classify(host) {
  if (!host) return 'unknown';
  if (isSelf(host)) return 'self';
  if (isPrimary(host)) return 'primary';
  if (isInterestedPrimary(host)) return 'interestedPrimary';
  if (isSecondary(host)) return 'secondary';
  return 'unclassified';          // a new source — worth a look, not an error
}

/** Hosts of every http(s) URL in a chunk of HTML, deduplicated.
 *
 * Scans ALL URLs, not just href attributes. This publication deliberately prints
 * each source URL as VISIBLE TEXT inside `<span class="u">`, because a hyperlink
 * is dead on paper — so many citations are not links at all. A scanner that reads
 * only `href="..."` measures a different, smaller population than one that reads
 * the text, which is exactly how two internally-consistent tools once disagreed. */
export function hostsIn(html) {
  return [...new Set([...html.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)]
    .map(m => hostOf(m[0])).filter(Boolean))];
}

/** Counts by class, plus the primary share — computed one way, everywhere. */
export function sourceMix(html) {
  const all = hostsIn(html);
  const by = { primary: [], interestedPrimary: [], secondary: [], unclassified: [], unknown: [], self: [] };
  for (const h of all) by[classify(h)].push(h);
  // Self-links are excluded from the denominator: they are navigation, not
  // sourcing, and counting them would let an issue dilute its own share by
  // linking to itself.
  const hosts = all.filter(h => classify(h) !== 'self');
  return {
    hosts, allHosts: all,
    ...by,
    // Deliberately excludes interestedPrimary. An issue could hit any share it
    // liked by leaning on civic bodies, and that is the bias we are trying to see.
    primaryShare: hosts.length ? Math.round((by.primary.length / hosts.length) * 100) : null,
  };
}

/** The issue's sections, each INCLUDING its trailing source list.
 *
 * Split on the section heading (`<h2 class="sec">`) rather than on `<section>`:
 * the source list sits AFTER `</section>`, so splitting on the element yields
 * sections with zero citations in them — which made a per-section sourcing check
 * silently vacuous rather than failing loudly. Splitting on the heading keeps
 * each section with the sources that belong to it. */
export function sectionsOf(html) {
  const parts = html.split(/<h2\b[^>]*class="sec"[^>]*>/i);
  return parts.slice(1);
}
