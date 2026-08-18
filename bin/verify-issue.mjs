#!/usr/bin/env node
/**
 * Publication gate.
 *
 *   node bin/verify-issue.mjs --week YYYY-MM-DD
 *   node bin/verify-issue.mjs --file <issue.html> [--facts <facts.json>]   (testing)
 *
 * Checks the issue an agent produced against (a) the structural rules the
 * publication promises its readers, and (b) the facts it was handed.
 *
 * The point is not to grade the prose. It is that an unattended model writes this
 * and nobody reads it before it goes public, so the promises that make an
 * AI-generated publication defensible — disclosure on every page, per-section
 * sources, citations, no invented numbers — have to be enforced by something that
 * cannot get tired or be persuaded. A rule that can be enforced in code should
 * never live only in the brief: the brief is advice to a model that may or may
 * not follow it; the gate is arithmetic.
 *
 * FATAL   = the issue does not keep a promise. Do not publish. Exit 1.
 * WARNING = worth a human glance, does not block.
 *
 * Every message says what to do about it, not just what is wrong.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ROOT, loadConfig } from './lib/config.mjs';
import {
  sourceMix, sectionsOf, isAdjacent, isNoVintage, isOfficialIncident, configured,
} from './source-classes.mjs';

const cfg = loadConfig();
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };

const week = arg('--week');
const fileOverride = arg('--file');
if (!week && !fileOverride) {
  console.error('usage: verify-issue.mjs --week YYYY-MM-DD  (or --file <issue.html> [--facts <facts.json>])');
  process.exit(2);
}
const issuePath = fileOverride ?? join(ROOT, 'issues', `${week}.html`);
const factsPath = arg('--facts') ?? (week ? join(ROOT, 'data', 'facts', `${week}.json`) : null);
const label = week ?? basename(issuePath);

if (!existsSync(issuePath)) { console.error(`::error::${issuePath} not found`); process.exit(1); }

const html  = readFileSync(issuePath, 'utf8');
const facts = factsPath && existsSync(factsPath) ? JSON.parse(readFileSync(factsPath, 'utf8')) : null;
// Entity-decode the common cases: section names contain "&", writers emit "&amp;".
const text  = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

const fatal = [], warn = [];
const need = (cond, msg) => { if (!cond) fatal.push(msg); };
const want = (cond, msg) => { if (!cond) warn.push(msg); };

/* ---------- 1. the disclosure promises ---------- */
need(/class="aibar"/.test(html),
  'No page-1 AI disclosure bar (.aibar). Every issue must disclose on the first screen — add the aibar block from the brief.');
need(/not reviewed by a human editor/i.test(text),
  'The phrase "not reviewed by a human editor" is missing. That is the core disclosure; it must appear verbatim.');
need(/About This Brief/i.test(text),
  'No "About This Brief — Method, Limitations, Disclaimers" section. Every issue carries its methodology.');
need(/not (?:legal|professional)[^.]*advice/i.test(text),
  'No not-professional-advice disclaimer. Add it to the About section. ' +
  'See prompts/write-issue.md rule 4 (disclosure), which lists it among the required disclosures.');

/* ---------- 2. attribution and citation ---------- */
const srcBlocks = (html.match(/Sources for this section/gi) || []).length;
need(srcBlocks >= 5,
  `Only ${srcBlocks} "Sources for this section" blocks. Every section must carry its own — a section without one is a section without provenance.`);
const cites = (html.match(/class="cite"/g) || []).length;
need(cites >= 10,
  `Only ${cites} inline citations. Load-bearing claims must cite the source entry they came from (<sup class="cite">).`);
const visibleUrls = (html.match(/class="u"/g) || []).length;
want(visibleUrls >= 10,
  `Only ${visibleUrls} visible source URLs — a hyperlink is dead on paper, so source entries should print their URL in <span class="u">.`);

/* ---------- 3. structure the site build depends on ---------- */
// Structure checks scan CONTENT, never the inlined stylesheet: a CSS comment
// naming the markup it styles would otherwise be counted as a front-page item,
// inflating the count and masking a real ceiling breach. (The raw `html` is
// still used below for the CSS-leak check, which is ABOUT the stylesheet.)
const contentHtml = html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
                        .replace(/<script[\s\S]*?<\/script>/gi, ' ');
const fpH = (contentHtml.match(/<p class="fp-h">/g) || []).length;
need(fpH >= 3, `Only ${fpH} front-page headlines (<p class="fp-h">). The archive list and RSS descriptions are built from these; the front page needs 3–6.`);
want(fpH <= 6, `${fpH} front-page items — the summary is meant to fit one page; more than 5 usually will not.`);
need(/class="frontpage"/.test(contentHtml),
  'No .frontpage block — the one-page summary is a required element. ' +
  'See prompts/write-issue.md, Structure: the front page is <section class="frontpage">.');

// CSS must not leak into the page as visible text. A stylesheet appended AFTER the
// closing </style> renders as a paragraph of source code at the top of the issue —
// which is exactly what shipped once in the reference implementation, because the
// injected block looked correct in the file and correct in a DOM test that had
// loaded the rules a different way. Cheap, absolute check: no CSS comment opener
// or @media rule should survive outside a <style> element.
{
  const withoutStyles = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  need(!/\/\*[\s\S]{0,80}?\*\//.test(withoutStyles),
    'A CSS comment appears outside <style> — stylesheet text is leaking into the page body. Move it inside the <style> block.');
  need(!/@media[^{]*\{/.test(withoutStyles),
    'An @media rule appears outside <style> — stylesheet text is leaking into the page body. Move it inside the <style> block.');
}

// Front-page items must be structurally IDENTICAL. One issue in the reference
// implementation shipped with item 5 written as `<div class="fp-rank low">` and a
// headline with no <b> — it rendered as a broken stylesheet rather than an
// editorial choice. There is no muted variant; every item carries equal weight.
// Split rather than match-with-lookahead: a lookahead terminator once silently
// parsed 4 of 5 blocks — and the one it skipped was the broken one. A structural
// check that quietly drops the last element is worse than none.
const fpItems = html.split('<div class="fp-item">').slice(1)
  .map(part => part.split(/<div class="fp-rule|<h2\b/)[0]);
need(fpItems.length >= 3, `Only ${fpItems.length} .fp-item blocks parsed; the front page needs at least 3.`);
fpItems.forEach((block, i) => {
  need(/<div class="fp-rank">\s*\d+\s*<\/div>/.test(block),
    `Front-page item ${i + 1}: .fp-rank is missing or carries a modifier class (e.g. "fp-rank low"). ` +
    `Every item uses exactly <div class="fp-rank">N</div> — there is no muted variant.`);
  need(/<p class="fp-h"><b>/.test(block),
    `Front-page item ${i + 1}: headline is not wrapped in <b> inside <p class="fp-h">. ` +
    `All headlines must be bold; one unbolded item looks like a rendering fault.`);
});

// Standing sections come from site.config.json. Missing one is a WARNING, not a
// failure: a genuinely quiet week should produce a shorter issue rather than
// padded prose. But a section that silently disappears between drafts should be
// visible, not invisible.
const FRONT_PAGE_NAMES = /^the week in one page$/i;
for (const sec of cfg.sections.filter(s => !FRONT_PAGE_NAMES.test(s))) {
  want(new RegExp(sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text),
    `No "${sec}" section this week. Fine if nothing happened — but say so in a short section rather than dropping it silently.`);
}
want(/Why it matters:/.test(text), 'No "Why it matters:" clause on the front page. Every lead item should say why a reader should care.');
need(!/class="why"/.test(html),
  'Found a .why callout box. Callout boxes are retired — the reasoning belongs in the prose, as a "Why it matters:" clause.');

// There is no mailing list. The feedback inbox (if configured) is one-directional.
// Language implying otherwise promises something the publication does not do and
// would import consent, unsubscribe and CAN-SPAM obligations onto a site that
// deliberately has none. A warning rather than a failure because "subscribe" is
// legitimate for RSS.
want(!/\b(?:subscribe to|sign up for|join)\s+(?:our|the|this)?\s*(?:newsletter|mailing list|email list|list)\b/i.test(text),
  'Issue appears to invite an email subscription. There is no mailing list — point readers at the RSS feed instead.');

// issues/ holds the BARE issue. build.mjs wraps it in the site chrome (nav, issue
// bar, footer, canonical/OG tags). Saving an already-built page back into issues/
// makes the next build wrap it a second time — two navs, two footers, and it looks
// like a CSS bug rather than a content bug.
for (const marker of ['sitenav', 'issuebar', 'sitefoot', 'site-chrome'])
  need(!html.includes(marker),
    `Issue already contains the site chrome ("${marker}"). issues/ must hold the bare issue — ` +
    `build.mjs adds the nav, issue bar and footer. Do not save a built page back into issues/.`);

// Geography honesty. Almost no US data geography (police district, school
// attendance zone, council ward) matches a postal ZIP. The config's geographyNote
// states your local mismatch; the About section should explain it to readers.
if (!cfg.geographyNote) {
  warn.push('site.config.json has no geographyNote. Find out which of your data geographies (police district, ' +
    'school zone, council district) differ from your ZIP boundary and record it — mislabeling a district figure ' +
    'as "the ZIP" is a quiet factual error. /find-sources helps fill this in.');
} else {
  want(/not the same (?:area|boundar|map)|different (?:map|geograph|boundar)|geograph/i.test(text),
    `The About section does not appear to explain your geography mismatch ("${cfg.geographyNote.slice(0, 60)}…"). ` +
    'Readers see a ZIP in the masthead and a district in the data sections; say they are different maps.');
}

/* ---------- 4. consistency with the facts it was handed ---------- */
if (!facts) {
  warn.push(`No facts file${factsPath ? ` at ${factsPath}` : ''} — could not cross-check any figure. ` +
    'Run bin/fetch-data.mjs before the writer, so every headline number is fetched rather than researched.');
} else {
  const appears = v => v != null && new RegExp(`\\b${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',?')}\\b`).test(text);

  // Every adapter block with a numeric `total` is a headline figure. Fetched but
  // absent is a WARN: deliberate omission is fine; silent divergence is not.
  const META = new Set(['week', 'queriedAt', 'zip', 'errors', 'notes', 'agentRules']);
  for (const [block, value] of Object.entries(facts)) {
    if (META.has(block) || typeof value !== 'object' || value === null) continue;
    if (typeof value.total === 'number') {
      want(appears(value.total),
        `${block}.total = ${value.total} was fetched but does not appear in the issue. Deliberate omission is fine; silent divergence is not.`);
    }
    // The lag-zero trap (bin/adapters/README.md §9): a source that lags returns
    // a true 0 for a window it has not covered yet, and "0 this week" printed
    // from it is a fabricated claim, not a missing one.
    if (typeof value.total === 'number' && value.total === 0) {
      if (typeof value.dataThrough === 'string' && value.dataThrough < week) {
        want(false,
          `${block}.total = 0 but the source's data only runs through ${value.dataThrough} (issue week ${week}). ` +
          `This is a lag zero, not a quiet week — the issue must name the window the data actually covers, ` +
          `never say "none this week". See bin/adapters/README.md §9.`);
      } else if (value.dataThrough === undefined) {
        want(false,
          `${block}.total = 0 with no dataThrough field — an honest zero and a lag zero are indistinguishable. ` +
          `Have the adapter record dataThrough (max date present in the source) per bin/adapters/README.md §9.`);
      }
    }

    // ---- WINDOW INTEGRITY -------------------------------------------------
    // The class of failure the other gates cannot see: a number that was really
    // fetched, by a query that really succeeded, computed correctly — and false,
    // because the WINDOW was wrong. Fetching moved the failure mode from the
    // value to the window. Two shapes, both found in the field on one afternoon:
    //
    //   1. A trailing window anchored to the ISSUE DATE over a source that lags.
    //      The newest window silently contains fewer days of data than the one
    //      it is compared against, and manufactures a collapse (a real case:
    //      62 vs 196, "-68% crime", entirely an artifact of a 13-day lag).
    //   2. A year-over-year comparison against a source with a ROLLING RETENTION
    //      window, which does not hold last year. The prior-year query returns
    //      the few late-filed stragglers still in the window and prints as a
    //      five-figure increase (a real case: 1,493 vs 16).
    //
    // These are WARNs, not FATALs: the adapter may have a good reason, and a
    // blunt rule here would train publishers to ignore it. But the class gets
    // something mechanical, per gates-not-promises.
    const win = value.measuredWindow;
    if (win?.end && typeof value.dataThrough === 'string' && win.end > value.dataThrough) {
      want(false,
        `${block}: the measured window ends ${win.end} but the data only runs through ${value.dataThrough}. ` +
        `A trailing window anchored past the newest record contains fewer days of data than its comparison ` +
        `and manufactures a false decline. Anchor windows to max(date_field), never to the issue date. ` +
        `See bin/adapters/README.md §9.`);
    }
    // A prior-period figure that is a small fraction of the current one is the
    // signature of a rolling-retention source, not of a real surge.
    const prior = value.priorYear ?? value.totalPriorYear ?? value.priorPeriod;
    if (typeof prior === 'number' && typeof value.total === 'number' &&
        prior > 0 && value.total > 50 && prior < value.total * 0.2) {
      want(false,
        `${block}: prior-period figure (${prior}) is under a fifth of the current one (${value.total}). ` +
        `Before publishing that as a change, confirm the source RETAINS the full prior period — a rolling ` +
        `12-month window returns only late-filed stragglers for "last year" and prints as a huge false increase. ` +
        `If the source is rolling, the comparison is unavailable: say so rather than computing it.`);
    }
  }

  // The failure that matters most: a figure the fetch could NOT get, asserted
  // anyway. If queries failed and the issue never admits a gap, that is the exact
  // shape of a fabricated number.
  if (facts.errors?.length) {
    const admits = /could not (?:be )?(?:sourced|retrieved|verified|confirmed)|unable to (?:source|retrieve)|not available this week|no data (?:was )?available/i.test(text);
    need(admits,
      `${facts.errors.length} data quer${facts.errors.length === 1 ? 'y' : 'ies'} failed, but the issue never says anything could not be sourced. ` +
      `That is the exact shape of a fabricated number. Failed: ${facts.errors.map(e => e.source || e.url).join('; ')}. ` +
      'Either admit the gap in reader-facing prose, or cut every claim that depended on the failed query.');
  }

  // Small-base honesty: notes the fetcher flagged should be reflected, not ignored.
  for (const noteText of facts.notes || []) {
    warn.push(`Fetcher note — check the issue honors it: ${noteText}`);
  }
}

/* ---------- 5. sourcing integrity ---------- */
// Every classification comes from bin/source-classes.mjs (which reads
// config/sources.json). One definition, every tool — see that file for why.

const mix = sourceMix(html);

// Independence, crudely but usefully: many citations drawn from very few hosts is
// the shape of an issue that looks corroborated and rests on one or two places.
want(mix.hosts.length >= 4,
  `Only ${mix.hosts.length} distinct host(s) across the whole issue. ` +
  'Corroboration is a second independent observation, not a second URL — widen the source base.');

const anyClassified = mix.primary.length + mix.interestedPrimary.length + mix.secondary.length > 0;
if (!anyClassified && mix.hosts.length) {
  warn.push(`None of the ${mix.hosts.length} cited hosts are classified yet. Run /find-sources (or edit config/sources.json) ` +
    'so the primary-share and Tier-A checks mean something. Unclassified hosts make every sourcing metric silently vacuous.');
} else {
  // interestedPrimary is reported but NOT counted toward the share. A civic body
  // is the record for its own proceedings and an interested party on anything
  // contested, so leaning on them could hit any share we asked for while
  // importing their framing.
  want(mix.primaryShare === null || mix.primaryShare >= 40,
    `Primary-source share is ${mix.primaryShare}% (${mix.primary.length} of ${mix.hosts.length} hosts). Target is 40%. ` +
    `Prefer the record over the write-up. Interested-primary sources, counted separately: ${mix.interestedPrimary.join(', ') || 'none'}.`);
  if (mix.unclassified.length)
    warn.push(`Unclassified host(s): ${mix.unclassified.join(', ')}. Add them to config/sources.json ` +
      'with a class, or the sourcing metrics quietly drift as new sources appear.');
}

// Tier A, checked WHERE THE CLAIM SITS. An earlier version of this check asked
// whether the issue cited an official host ANYWHERE — with dozens of hosts that
// test is unfalsifiable, so the rule read as satisfied while the requirement was
// not met. A fatality reported in a section citing one feed is single-sourced no
// matter how well-sourced the rest of the paper is.
const TIER_A = /\b(?:homicides?|killed|fatal(?:ly|ity|ities)?|died|deaths?|murder(?:ed)?|shot dead|stabbed|shooting)\b/i;
const sections = sectionsOf(html);
let tierASections = 0;
sections.forEach((sec, i) => {
  const secText = sec.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (!TIER_A.test(secText)) return;
  tierASections++;
  const m = sourceMix(sec);
  const hasOfficial = m.hosts.some(isOfficialIncident);
  if (configured.officialIncident) {
    need(hasOfficial,
      `Section ${i + 1} reports a death or violent incident but cites no official incident record ` +
      `IN THAT SECTION. Hosts there: ${m.hosts.join(', ') || 'none'}. ` +
      'Tier A requires the official record (config/sources.json → officialIncident), not coverage of one.');
  } else {
    warn.push(`Section ${i + 1} reports a death or violent incident, and config/sources.json has no officialIncident ` +
      'hosts configured, so this cannot be checked. Add your police department / open-data portal to officialIncident — ' +
      'a fatality cited only to news outlets is not corroborated, however many outlets carried it.');
  }
  want(m.hosts.length >= 2,
    `Section ${i + 1} reports a death or violent incident on ${m.hosts.length} source(s): ` +
    `${m.hosts.join(', ') || 'none'}. Tier A wants two independent observations — the incident feed alone is one source.`);
});

// Reported crime is not crime. Incident feeds record reports; police departments
// call their own figures preliminary and subject to reclassification.
want(!/\bcrime (?:rose|fell|increased|decreased|is up|is down|was up|was down|dropped|climbed)\b/i.test(text),
  '"crime rose/fell" appears without the word "reported". Incident feeds record reports, not incidence — say "reported crime".');

// Adjacent jurisdictions: a place name that exists on both sides of a boundary is
// a standing trap ("Chevy Chase" is in both DC and Maryland; your area has its
// own version).
const citedAdjacent = mix.hosts.filter(isAdjacent);
if (citedAdjacent.length)
  want(/\bcounty\b|\bcity of\b|\btown of\b|\bvillage of\b|across the (?:line|border|boundary)/i.test(text),
    `Adjacent-jurisdiction source(s) cited (${citedAdjacent.join(', ')}) but the issue never names which jurisdiction ` +
    'an item belongs to. Different police, schools, and government — say which side of the line each item is on.');

// Sources that revise silently and keep no vintages cannot be checked later
// unless the figure was snapshotted at publication (in the facts file).
const noVintage = mix.hosts.filter(isNoVintage);
if (noVintage.length) {
  const snapshotted = facts && noVintage.every(h => JSON.stringify(facts).toLowerCase().includes(h.split('.')[0]));
  want(!!snapshotted,
    `Silently-revising source(s) cited (${noVintage.join(', ')}) with no snapshot in the facts file. ` +
    'They publish no archived vintages, so an unsnapshotted figure becomes permanently uncheckable — fetch it, don\'t quote it.');
}

// A figure the issue itself admits it could not reconfirm should be CUT, not
// caveated. Disclosure is not a substitute for a decision.
want(!/from the (?:prior|previous) (?:edition|week)|not (?:independently )?reconfirmed|carried (?:over|forward)/i.test(text),
  'The issue admits a figure was carried over from a prior edition without reconfirmation. ' +
  'Disclosure is right and keeping it is wrong — an unverifiable number should be cut, not caveated.');

/* ---------- 6. record identifiers must be real AND authorized ---------- */
// Two failure modes, one check. An invented case/docket number sends a reader to
// the wrong record; a REAL number for the wrong kind of case can identify a
// household (many permit/zoning portals show the applicant's name). If your
// docket adapter publishes an authorized list in facts.dockets, every identifier
// cited must come from it — any other number came from memory or from somewhere
// it should not have.
const citedCases = new Set(
  [...html.matchAll(/\b(?:Case|Docket|Application|Petition|Permit)\s*(?:No\.?|Number|#)\s*([A-Z0-9][A-Z0-9.\-\/]{2,15})/gi)]
    .map(m => m[1].replace(/[.,;:]+$/, '')),
);
if (citedCases.size) {
  if (!facts?.dockets) {
    warn.push(`The issue cites record identifier(s) ${[...citedCases].join(', ')} but the facts file has no dockets ` +
      'block, so none can be checked against a fetched record. Never invent, complete, or adjust an identifier — ' +
      'if your area has a docket feed, add an adapter so identifiers are fetched, not recalled.');
  } else {
    const authorized = new Set([
      ...(facts.dockets.open || []).map(c => String(c.caseNumber)),
      ...(facts.dockets.decided || []).map(c => String(c.caseNumber)),
    ]);
    const unauthorized = [...citedCases].filter(c => !authorized.has(c));
    need(unauthorized.length === 0,
      `Record identifier(s) cited that the docket fetch did not authorize: ${unauthorized.join(', ')}. ` +
      `Authorized: ${[...authorized].join(', ') || 'none this week'}. Either the number was invented — which sends a ` +
      'reader to the wrong record — or it arrived by a route the privacy design deliberately withholds.');
  }
}

/* ---------- report ---------- */
console.log(`verify ${label} (${issuePath})`);
console.log(`  sections with sources: ${srcBlocks} · citations: ${cites} · front-page items: ${fpH}`);
console.log(`  hosts: ${mix.hosts.length} · primary ${mix.primary.length} (${mix.primaryShare ?? '–'}%) · `
  + `interested-primary ${mix.interestedPrimary.length} · secondary ${mix.secondary.length} · unclassified ${mix.unclassified.length}`);
console.log(`  Tier A sections: ${tierASections}`);
for (const w of warn)  console.log(`::warning::${w}`);
for (const f of fatal) console.error(`::error::${f}`);

if (fatal.length) {
  console.error(`\nVERIFY FAILED — ${fatal.length} broken promise(s). Not publishing.`);
  process.exit(1);
}
console.log(`\nverify passed${warn.length ? ` with ${warn.length} warning(s)` : ''}`);
