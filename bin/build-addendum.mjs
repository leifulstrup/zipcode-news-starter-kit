#!/usr/bin/env node
/**
 * build-addendum.mjs — the editor's addendum. NOT PUBLISHED.
 *
 *   node bin/build-addendum.mjs --week YYYY-MM-DD [--out addendum]
 *
 * Writes addendum/<week>.html: what was fetched, what failed, and what a human
 * should check before trusting the issue. Every item is a QUESTION, not a
 * verdict — the addendum's job is to point, not to judge.
 *
 * WHY THIS EXISTS. Operational detail (which endpoint 403'd, which value is null)
 * is plumbing; putting it in the issue makes the publication read like a build
 * log. It moves here. WHAT DOES NOT MOVE: if a figure could not be sourced, the
 * ISSUE must still say so in plain reader-facing language — verify-issue fails a
 * run whose facts file has errors but whose issue admits nothing. Moving the
 * detail out is a readability change, never a reduction in what readers are told.
 *
 * This is also the private channel for source doubt. The publication never
 * carries our reservations about the local outlets and bodies it compiles from —
 * that would read as a newsletter picking fights with the neighbors it depends
 * on. The reservations still need somewhere a human sees them; this is it.
 *
 * build.mjs reads only issues/, so nothing here can leak onto the public site.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadConfig, displayName, ROOT } from './lib/config.mjs';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const config = loadConfig();
const week = arg('--week', new Date().toISOString().slice(0, 10));
const OUT = join(ROOT, arg('--out', 'addendum'));

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const factsPath = join(ROOT, 'data', 'facts', `${week}.json`);
const issuePath = join(ROOT, 'issues', `${week}.html`);
const facts = existsSync(factsPath) ? JSON.parse(readFileSync(factsPath, 'utf8')) : null;
const issue = existsSync(issuePath) ? readFileSync(issuePath, 'utf8') : '';
const text = issue.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/* ---------- what the run produced ---------- */
const errors = facts?.errors ?? [];

// Every scalar-bearing leaf that came back null, by dotted path — an honest
// admission in the data that must have become an admission in the prose.
const nulls = [];
(function walkNulls(obj, path) {
  if (obj === null) { if (path) nulls.push(path); return; }
  if (typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (['errors', 'notes', 'agentRules', 'queriedAt', 'geographyNote'].includes(k) && !path) continue;
    walkNulls(v, path ? `${path}.${k}` : k);
  }
})(facts ?? {}, '');

/* ---------- things a human should actually look at ---------- */
const checks = [];
const push = (level, q, why) => checks.push({ level, q, why });

if (!facts)
  push('high', 'No facts file exists for this week. Where did every figure in the issue come from?',
    'Nothing was fetched, so nothing can be checked later. Any number in the prose came from the model or from cited pages — trace the load-bearing ones by hand.');

if (errors.length)
  push('high', `${errors.length} data quer${errors.length === 1 ? 'y' : 'ies'} failed. Does the issue say so?`,
    errors.map(e => `${e.source}: ${e.message}`).join(' · '));

if (nulls.length)
  push('high', `Null values present: ${nulls.slice(0, 12).join(', ')}${nulls.length > 12 ? '…' : ''}. Any figure quoted for these was not fetched.`,
    'A null means retrieval failed. Anything the issue states about these came from somewhere else — find out where.');

// Figures in the prose that are nowhere in the facts file are the most dangerous
// thing this pipeline can produce; fatality and violence claims most of all.
for (const term of ['homicide', 'shooting', 'stabbing', 'fatal', 'death', 'killed', 'murder']) {
  const inIssue = new RegExp(`\\b${term}`, 'i').test(text);
  const inFacts = JSON.stringify(facts ?? {}).toLowerCase().includes(term);
  if (inIssue && !inFacts)
    push('high', `The issue mentions "${term}" but the facts file has no such field.`,
      'A violent-crime or fatality claim that was not fetched must trace to a named official or news source in the same section. If it cannot be traced, it should have been cut, not caveated.');
}

const bytes = issue.length;
if (issue && bytes < 40000)
  push('high', `Issue is ${(bytes / 1024).toFixed(1)} KB — a complete issue usually runs 60–90 KB.`,
    'A short issue usually means the agent was truncated mid-draft. Check num_turns against --max-turns in the run log.');

if (!config.geographyNote)
  push('medium', 'site.config.json has no geographyNote. Does any data section explain its geography?',
    'Police districts, school zones, and council wards almost never match a postal ZIP. Until the mismatch is written down, every data section risks attributing agency-geography figures to the ZIP.');

if (/\b(crime|incidents?) (?:rose|fell|increased|decreased|dropped|climbed|is up|is down)\b/i.test(text) && !/reported/i.test(text))
  push('medium', 'A bare "crime rose/fell" appears with no "reported" nearby.',
    'Police feeds record reports, not incidence, and agencies call their own figures preliminary. "Reported incidents" is the accurate phrasing and costs one word.');

if (/\bmailing list|subscribe by email|sign.?up\b/i.test(text))
  push('medium', 'Subscription-ish language appears.',
    'There is no mailing list — running one imports consent records, unsubscribe law, and a privacy surface the kit deliberately avoids. RSS is the subscription mechanism.');

// Source-mix questions, classified by the same definitions the gate and rubric
// use. source-classes.mjs may not exist yet on a half-assembled kit — degrade
// with a note rather than crashing the addendum.
try {
  const { sourceMix } = await import('./source-classes.mjs');
  const mix = sourceMix(issue);
  if (mix.hosts.length && mix.primaryShare < 40)
    push('medium', `${mix.primary.length} of ${mix.hosts.length} cited hosts are primary records (${mix.primaryShare}%).`,
      'Below the 40% target. Not a failure by itself — check whether the secondary sources are independent of each other or all tracing to one press release. Interested-primary sources are counted separately on purpose.');
  if (mix.unclassified?.length)
    push('medium', `Unclassified source host(s): ${mix.unclassified.join(', ')}.`,
      'A new source appeared. Classify it in config/sources.json, or the sourcing metrics drift quietly as the registry grows.');
} catch {
  push('medium', 'bin/source-classes.mjs could not be loaded — source-mix checks skipped.',
    'The addendum could not classify cited hosts. If the file exists, something in it is broken; if not, the kit is half-assembled.');
}

/* ---------- render ---------- */
const badge = l => `<span class="b ${l}">${l === 'high' ? 'CHECK FIRST' : 'WORTH A LOOK'}</span>`;

// Flat rows of everything fetched, by dotted path, nulls highlighted.
const flat = [];
(function walk(obj, path) {
  if (obj === null || typeof obj !== 'object') { flat.push([path, obj]); return; }
  for (const [k, v] of Object.entries(obj)) {
    if (['errors', 'notes', 'agentRules'].includes(k) && !path) continue;
    walk(v, path ? `${path}.${k}` : k);
  }
})(facts ?? {}, '');
const rows = flat.filter(([p]) => p && !['week', 'generatedFor', 'generator', 'zip', 'queriedAt', 'geographyNote'].includes(p))
  .map(([p, v]) => `<tr><td>${esc(p)}</td><td class="${v === null ? 'null' : ''}">${v === null ? 'null — not retrieved' : esc(JSON.stringify(v))}</td></tr>`).join('');

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Editor's addendum — ${esc(displayName(config))} — ${esc(week)}</title>
<style>
 :root{--ink:${esc(config.colors.ink || '#1a1a1a')};--soft:#5c5c5c;--line:#d8d4cc;--hi:#8a2e2e;--med:#8a5a12}
 body{background:${esc(config.colors.paper)};color:var(--ink);margin:0;padding:32px 24px 80px;
   font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
 .w{max-width:820px;margin:0 auto}
 h1{font-family:Georgia,serif;font-size:27px;margin:0 0 4px}
 .sub{color:var(--soft);font-size:13px;margin-bottom:22px}
 .note{background:#fff8e8;border-left:3px solid var(--med);padding:12px 15px;font-size:13.5px;margin-bottom:26px}
 h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;margin:30px 0 8px}
 .rule{height:2px;background:var(--ink);margin-bottom:14px}
 .c{border:1px solid var(--line);background:#fff;padding:13px 16px;margin-bottom:10px;border-radius:3px}
 .c .q{font-weight:600}
 .c .why{color:var(--soft);font-size:13.5px;margin-top:5px}
 .b{font-size:10px;letter-spacing:.09em;font-weight:700;color:#fff;padding:2px 6px;border-radius:2px;margin-right:8px}
 .b.high{background:var(--hi)} .b.medium{background:var(--med)}
 table{border-collapse:collapse;width:100%;font-size:13.5px}
 td{border-bottom:1px solid var(--line);padding:5px 8px}
 td:first-child{color:var(--soft);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;width:52%}
 .null{color:var(--hi);font-weight:600}
 .ok{background:#f0f6f0;border-left:3px solid #4a7a4a;padding:12px 15px;font-size:14px}
 footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);color:var(--soft);font-size:12.5px}
</style></head><body><div class="w">
<h1>Editor's addendum</h1>
<div class="sub">${esc(displayName(config))} · issue of ${esc(week)} · facts queried ${esc(facts?.queriedAt ?? 'never')}</div>

<div class="note"><b>Not for publication.</b> This file lives in <code>addendum/</code>, which
<code>build.mjs</code> never reads, so it cannot reach the site. It is the operational record that
would otherwise clutter the issue — which query failed, which value is null, what a human should
look at. The reader-facing promise is unchanged: if something could not be sourced, the issue still
has to say so in plain language, and <code>bin/verify-issue.mjs</code> fails the run if it does not.</div>

<h2>Check before trusting</h2><div class="rule"></div>
${checks.length
  ? checks.sort((a, b) => (a.level === 'high' ? -1 : 1) - (b.level === 'high' ? -1 : 1))
      .map(c => `<div class="c"><div class="q">${badge(c.level)}${esc(c.q)}</div><div class="why">${esc(c.why)}</div></div>`).join('\n')
  : '<div class="ok">Nothing flagged. Every query returned, no null values, no untraceable claims detected, and the issue is a normal length. Still worth reading before it goes out.</div>'}

<h2>What was fetched</h2><div class="rule"></div>
${rows ? `<table><tbody>${rows}</tbody></table>` : '<p class="why">No facts file was found for this week.</p>'}

${errors.length ? `<h2>Failed queries</h2><div class="rule"></div><table><tbody>${
  errors.map(e => `<tr><td>${esc(e.source)}</td><td class="null">${esc(e.message)}</td></tr>`).join('')}</tbody></table>` : ''}

<h2>Geography</h2><div class="rule"></div>
<p class="why">${esc(config.geographyNote || 'No geographyNote is set in site.config.json yet. Write down how your data geographies (police districts, school zones, wards) differ from the postal ZIP — every data section depends on that honesty.')}</p>

<footer>Generated by <code>bin/build-addendum.mjs</code>. Issue: ${(bytes / 1024).toFixed(1)} KB.
Sources registry: <code>data/sources-ranked.md</code>. Standing rules: <code>data/lessons-learned.md</code>.</footer>
</div></body></html>`;

mkdirSync(OUT, { recursive: true });
const outFile = join(OUT, `${week}.html`);
writeFileSync(outFile, html);

const high = checks.filter(c => c.level === 'high').length;
console.log(`addendum -> ${relative(ROOT, outFile)}`);
console.log(`  ${checks.length} item(s) to check · ${high} marked CHECK FIRST · ${errors.length} failed quer${errors.length === 1 ? 'y' : 'ies'}`);

// Machine-readable for the workflow summary / review issue.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `high=${high}\ntotal=${checks.length}\n`);
}
if (process.env.ADDENDUM_MD) {
  writeFileSync(process.env.ADDENDUM_MD,
    checks.length
      ? checks.map(c => `- **${c.level === 'high' ? 'CHECK FIRST' : 'Worth a look'}** — ${c.q}\n  - ${c.why}`).join('\n')
      : '_Nothing flagged._');
}
