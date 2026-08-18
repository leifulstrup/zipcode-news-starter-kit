#!/usr/bin/env node
/**
 * QA-QC/measure-issue.mjs — evidence for The Seven Questions.
 *
 *   node QA-QC/measure-issue.mjs issues/YYYY-MM-DD.html   (from the repo root)
 *
 * This does NOT score. It counts things a human would otherwise count by hand, so
 * the twenty-minute review is spent on judgement rather than tallying. Assumption
 * A7 of the rubric: a high citation count can decorate a weak claim. Read the issue.
 *
 * Output goes to stdout; for real issues (files under issues/) a copy is archived
 * to QA-QC/measurements/<date>.json so the numbers can be trended across editions.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, resolve, join, sep } from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: node QA-QC/measure-issue.mjs <issue.html>'); process.exit(2); }

// Classification is NOT defined here. It lives in bin/source-classes.mjs, because
// in the reference implementation this script and the publication gate once
// reported different primary shares for the same issue and each was internally
// consistent. A metric two tools define differently cannot be trended, so there is
// one definition. Fails loudly: scoring with a second, divergent definition of
// "primary source" is the bug this import exists to prevent.
let classes, config;
try {
  classes = await import('../bin/source-classes.mjs');
  config = await import('../bin/lib/config.mjs');
} catch (e) {
  console.error('FATAL: cannot load ../bin/source-classes.mjs — run this from the repo root:');
  console.error('  node QA-QC/measure-issue.mjs issues/<week>.html');
  console.error(`(${e.message})`);
  process.exit(2);
}
const cfg = config.loadConfig();

const raw = readFileSync(file, 'utf8');
// Strip <style> and <script> BEFORE any text analysis. CSS is full of percentages
// (flex: 0 0 42%) and the first version of this script counted them as editorial
// claims, understating the share of percentages paired with absolute numbers.
// Assumption A7 in practice: the script produced a misleading number and reading
// the output caught it.
const html = raw.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const n = (re) => (text.match(re) || []).length;
const nh = (re) => (html.match(re) || []).length;
const list = (re, cap = 24) => [...new Set((text.match(re) || []))].slice(0, cap);
const zipEsc = String(cfg.zip).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Q1 traceability ----------
const cites = nh(/<sup class="cite"/g);
const srcBlocks = nh(/Sources for this section/gi);
const mix = classes.sourceMix(raw);

// ---------- Q2 honest uncertainty ----------
const admits = n(/could not (?:be )?(?:sourced|obtained|retrieved|verified|confirmed)|no published|not published|unavailable|has not (?:been )?(?:published|announced)|we could not/gi);
const hedges = n(/\b(?:roughly|about|approximately|appears|suggests|may|likely|estimated|reported(?:ly)?|as of)\b/gi);
const smallBase = n(/small (?:base|numbers?)|handful|thin (?:market|data)|single (?:sale|incident|observation)|one (?:unusual )?sale|noise\b|not (?:a trend|proof)/gi);
const falsePrecision = n(/\b\d+\.\d%/g);

// ---------- Q3 local specificity ----------
// Generic named-place shapes (street/institution suffixes) rather than a hardcoded
// entity list: portable across ZIPs, and still a density signal. Judgement decides
// whether the named places are the RIGHT places.
const namedPlaces = list(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}\s(?:Avenue|Ave\.?|Street|St\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Drive|Parkway|Park|School|Library|Plaza|Square|Trail|Circle|Center|Centre|Station)\b/g);
const zipMentions = n(new RegExp(`\\b${zipEsc}\\b`, 'g'));
const zipCrimeMisattributions = n(new RegExp(`(?:crime|incidents?|thefts?)[^.]{0,40}\\bin ${zipEsc}\\b|\\b${zipEsc} (?:saw|recorded|reported)\\b`, 'gi'));
const geographyExplained = n(/not the same (?:area|boundar|map)|different (?:map|geograph|boundar)|police (?:district|service area|patrol) geograph/gi);
const civicBodies = n(/\b(?:city council|county council|commission|school board|planning board|zoning board|advisory (?:neighborhood )?commission|civic association|community association)\b/gi);

// ---------- Q4 interest breadth ----------
const constituencies = {
  renters:   n(/\brent(?:er|ers|ing|al)\b|tenant/gi),
  // Widened after a field false-negative: an issue that EXPLICITLY contrasted
  // "renters rather than owners" scored 0 because bare "owners" didn't match,
  // while a weaker issue scored 1 off an incidental "property values". The bare
  // \bowners?\b will over-match occasionally (business owners); this metric is
  // advisory, so a false positive costs five minutes and a false negative costs
  // the thing the metric exists for.
  owners:    n(/\bhomeowner|home ?owner|owner-occup|\bowners?\b|property (?:tax|value)|own or rent/gi),
  carFree:   n(/without a car|car-free|walk(?:ing|able)|bus|shuttle|metro|transit|bike|cycl/gi),
  families:  n(/famil(?:y|ies)|student|parent|school/gi),
  adjacent:  n(/\b(?:county line|city limits|across the (?:line|border)|neighboring (?:town|county|city))\b/gi),
  smallBiz:  n(/small business|shop|storefront|merchant|restaurant|retail/gi),
  seniors:   n(/senior|older resident|accessib/gi),
};

// ---------- Q5 actionability ----------
const datesWithTime = n(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}[^.]{0,40}?\b\d{1,2}(?::\d{2})?\s?(?:a\.m\.|p\.m\.|am|pm)/gi);
const bareDates = n(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/g);
// Widened after field testing: big-city record systems use Project/File/Council
// File (CF) numbers that serve the reader identically to a docket number. Even
// so, a zero here can be a measurement gap rather than an editorial failure —
// check what identifier shape YOUR jurisdiction uses before treating 0 as a miss.
const dockets = n(/\b(?:Case|Docket|Bill|Order|Application|Resolution|Permit|Petition|Project|File|Council File|CF)\s?(?:No\.?\s?)?[\dA-Z][\d\-.A-Z]{2,}/g);
const deadlines = n(/deadline|comment period|by (?:the )?\w+ \d{1,2}|closes? (?:on )?\w+ \d{1,2}|due (?:by|on)/gi);
const contacts = n(/mailto:|@[\w.-]+\.\w+|call \d|\(\d{3}\)|contact the/gi);
const openData = n(/open ?data|dataset|data portal|\bAPI\b/gi);

// ---------- Q6 framing restraint ----------
const superlatives = n(/\b(?:unprecedented|shocking|alarming|explosive|soar(?:ed|ing)|plummet(?:ed|ing)|skyrocket|crisis|devastat|massive|huge|dramatic(?:ally)?|stunning|slam(?:med)?)\b/gi);
const pctClaims = n(/\d+(?:\.\d+)?%/g);
// Count a percentage as "paired" if an absolute count or a comparison value appears
// in the same sentence, in any order. House style is "178 incidents against 141 a
// year ago, up 26%".
const sentences = text.split(/(?<=[.!?])\s+/);
const pctSentences = sentences.filter(x => /\d+(?:\.\d+)?%/.test(x));
const pctWithAbs = pctSentences.filter(x =>
  /\b\d[\d,]*\s*(?:against|versus|vs\.?|to|from|of|out of|incidents|homes|units|requests|sales?)\b/i.test(x)
  || /\(\s*[+−-]\s*\d/.test(x) || /\$\d/.test(x)).length;
const priorYear = n(/prior year|last year|year (?:earlier|ago)|same period|year-over-year|YTD/gi);

// ---------- Q7 disclosure ----------
const feedbackRe = cfg.contactEmail
  ? new RegExp(`mailto:[^"']*${cfg.contactEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
  : /mailto:/g;
const disclosure = {
  aibar:        nh(/class="aibar"/g),
  notReviewed:  n(/not reviewed by a human (?:editor|fact)/gi),
  aiWritten:    n(/written by an AI|AI-generated|generated by an AI/gi),
  aboutSection: n(/About This Brief/gi),
  notAdvice:    n(/not (?:legal|professional|financial)[^.]{0,60}advice/gi),
  feedbackRoute: nh(feedbackRe),
};

const out = {
  file,
  bytes: html.length,
  words: text.split(' ').length,
  Q1_traceability: { inlineCitations: cites, sectionSourceBlocks: srcBlocks,
    distinctHosts: mix.hosts.length,
    primaryHosts: mix.primary, interestedPrimaryHosts: mix.interestedPrimary,
    secondaryHosts: mix.secondary, unclassifiedHosts: mix.unclassified,
    // interestedPrimary is excluded from the numerator on purpose: a civic body is
    // the record for its own proceedings and an interested party on anything
    // contested, so counting them would let the issue reach any share it liked
    // while importing an interested framing as neutral.
    primaryShare: (mix.primaryShare ?? 0) + '%',
    selfLinksExcluded: mix.self },
  Q2_honest_uncertainty: { admissions: admits, hedges, smallBaseCaveats: smallBase, decimalPercents: falsePrecision },
  Q3_local_specificity: { zipMentions, zipCrimeMisattributions,
    geographyExplained, geographyNoteConfigured: !!cfg.geographyNote,
    civicBodies, namedLocalEntities: namedPlaces },
  Q4_interest_breadth: constituencies,
  Q5_actionability: { datesWithTimes: datesWithTime, bareDates, docketIdentifiers: dockets,
    deadlines, contactRoutes: contacts, openDataPointers: openData },
  Q6_framing_restraint: { superlatives, percentageClaims: pctClaims,
    sentencesContainingPercentages: pctSentences.length,
    ofThosePairedWithAbsolutes: pctWithAbs,
    pairedShare: pctSentences.length ? (pctWithAbs / pctSentences.length * 100).toFixed(0) + '%' : 'n/a',
    priorPeriodComparisons: priorYear },
  Q7_disclosure: disclosure,
};
console.log(JSON.stringify(out, null, 1));

// Archive real issues only — fixtures and ad-hoc files stay out of the trend line.
const abs = resolve(file);
if (abs.includes(`${sep}issues${sep}`)) {
  const dir = join(config.ROOT, 'QA-QC', 'measurements');
  mkdirSync(dir, { recursive: true });
  const stem = basename(file).replace(/\.html?$/i, '');
  const dest = join(dir, stem + '.json');
  writeFileSync(dest, JSON.stringify(out, null, 1));
  console.error(`archived → ${dest}`);

  // Regression check against the previous edition's archived measurement.
  // A per-issue fix to a rubric dimension is not a fix — it is a patch on one
  // file, and the next issue regresses it with every gate green (field-tested:
  // "renters named" went 0 → fixed to 4 → back to 0 one issue later). A drop
  // TO ZERO from non-zero on a dimension the publisher already decided matters
  // is far more actionable than any absolute score. Advisory only: warnings,
  // never a failure — measurement informs judgement, it does not replace it.
  const prior = readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.replace('.json', '') < stem)
    .sort()
    .pop();
  if (prior) {
    const prev = JSON.parse(readFileSync(join(dir, prior), 'utf8'));
    const WATCH = [
      ['Q4_interest_breadth', ['renters', 'owners', 'carFree', 'families', 'smallBiz', 'seniors']],
      ['Q5_actionability', ['docketIdentifiers', 'deadlines', 'contactRoutes', 'datesWithTimes', 'openDataPointers']],
    ];
    let regressions = 0;
    for (const [group, keys] of WATCH) {
      for (const k of keys) {
        const was = prev[group]?.[k], now = out[group]?.[k];
        if (typeof was === 'number' && was > 0 && now === 0) {
          regressions++;
          console.error(`::warning::REGRESSION ${group}.${k}: ${was} in ${prior.replace('.json', '')} -> 0 now. ` +
            `The previous issue met this dimension and this one dropped it entirely. If the fix that ` +
            `produced the ${was} lived only in that issue's text, move it into prompts/write-issue.md — ` +
            `a rule that must hold across issues cannot live in one artefact.`);
        }
      }
    }
    if (!regressions) console.error(`no zero-regressions vs ${prior.replace('.json', '')}`);
  }
}
