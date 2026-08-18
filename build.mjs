#!/usr/bin/env node
/**
 * build.mjs — static site builder for the zipcode-news starter kit.
 *
 *   node build.mjs
 *
 * Reads  site.config.json          (identity: name, ZIP, colors, contact — §2 of docs/CONTRACT.md)
 *        issues/YYYY-MM-DD.html    (bare issue documents — §5 of docs/CONTRACT.md)
 *        issues/YYYY-MM-DD.pdf     (optional print edition for the same date)
 *
 * Writes public/ — the directory the Cloudflare Worker serves:
 *        /                         latest issue (or a "first issue coming soon" page)
 *        /YYYY-MM-DD/              permanent URL for each issue
 *        /archive/                 dated index of all issues
 *        /about/                   how it is made, AI disclosure, corrections
 *        /issues/YYYY-MM-DD.pdf    print edition
 *        /feed.xml + /feed.xsl     RSS 2.0, human-readable in a browser
 *        /sitemap.xml, /robots.txt, /404.html, /_headers, /_redirects
 *
 * Issues are self-contained (inline CSS, no external assets), so the build
 * injects a small site chrome — nav, issue bar, footer — rather than
 * re-templating the content. One issue file stays usable both as a standalone
 * artifact and as a web page.
 *
 * A fresh clone with an empty issues/ MUST build green: onboarding gets the
 * site serving before the first issue exists.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, displayName, siteOrigin, ROOT } from './bin/lib/config.mjs';
// Shared with bin/normalize-issue.mjs so the site, the PDF and the raw issue
// cannot drift apart. One definition, three consumers.
import { outboundNewTab } from './bin/normalize-issue.mjs';

const cfg  = loadConfig();
const SRC  = path.join(ROOT, 'issues');
const OUT  = path.join(ROOT, 'public');
const SITE = siteOrigin(cfg);            // '' until a domain (or workers.dev host) is configured
const NAME = displayName(cfg);
const TAG  = cfg.tagline || `A weekly brief for ZIP code ${cfg.zip}`;
const ACCENT = cfg.colors.accent || '#7a2e2e';
const PAPER  = cfg.colors.paper  || '#fbfaf7';
const INK    = cfg.colors.ink    || '#1a1a1a';
const DISCLOSURE = 'AI-generated (Claude, Anthropic) — not reviewed by a human editor';

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip = h => h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

function longDate(iso){
  const [y,m,d] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  return `${months[m-1]} ${d}, ${y}`;
}
function rfc822(iso){
  // Noon UTC on the publication date: close enough and stable across rebuilds.
  return new Date(`${iso}T12:00:00Z`).toUTCString();
}
const mailtoHref = () => cfg.contactEmail
  ? `mailto:${cfg.contactEmail}?subject=${encodeURIComponent(`${cfg.siteName} — suggestion or correction`)}`
  : '';

/* ---------- discover issues (zero is a valid count) ---------- */
if (!existsSync(SRC)) { console.error('no issues/ directory'); process.exit(1); }
const issues = readdirSync(SRC)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
  .map(f => f.replace(/\.html$/,''))
  .sort()
  .reverse();                                    // newest first

/* ---------- parse each issue for metadata ---------- */
const meta = issues.map(date => {
  const html = readFileSync(path.join(SRC, `${date}.html`), 'utf8');
  // Front-page item headlines double as the issue's contents list (archive + RSS).
  // Scan CONTENT only: an issue inlines its stylesheet, and a CSS comment that
  // mentions the markup it styles (`/* <p class="fp-h"><b>…</b></p> */`) is
  // otherwise extracted as a headline — and, sitting in <style> at the top of
  // the file, becomes the FIRST one. That shipped a phantom "…" as the lead
  // bullet of every archive entry and RSS description until a field instance
  // caught it. Never scan a stylesheet for content markup.
  const content = html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
                      .replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const heads = [...content.matchAll(/<p class="fp-h">([\s\S]*?)<\/p>/g)]
    .map(m => strip(m[1]));
  const vol = (html.match(/Vol\.\s*\d+,\s*No\.\s*\d+/) || [''])[0];
  const pdf = existsSync(path.join(SRC, `${date}.pdf`)) ? `${date}.pdf` : null;
  return { date, html, heads, vol, pdf };
});

/* ---------- site chrome injected into each issue ---------- */
const CHROME_CSS = `
<style id="site-chrome">
  .sitenav{position:sticky;top:0;z-index:50;background:${PAPER}f0;
    backdrop-filter:saturate(160%) blur(8px);border-bottom:1px solid #d8d4cc;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
  .sitenav .in{max-width:760px;margin:0 auto;padding:9px 24px;display:flex;
    align-items:center;gap:16px;flex-wrap:wrap}
  .sitenav a.brand{font-family:Georgia,serif;font-size:17px;font-weight:700;color:${INK};
    border-bottom:none;letter-spacing:-.01em}
  .sitenav a.brand span{color:${ACCENT}}
  .sitenav nav{margin-left:auto;display:flex;gap:15px;font-size:12.5px}
  .sitenav nav a{color:#4a4a4a;border-bottom:none}
  .sitenav nav a:hover{color:${ACCENT};border-bottom:1px solid ${ACCENT}}
  .sitenav .ai{font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
    color:#fff;background:#8a5a12;padding:2px 6px;border-radius:2px}
  .sitefoot{max-width:760px;margin:0 auto;padding:26px 24px 60px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:12.5px;line-height:1.6;color:#767676;border-top:1px solid #d8d4cc}
  .sitefoot a{color:${ACCENT}}
  .issuebar{max-width:760px;margin:0 auto;padding:14px 24px 0;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:12.5px;color:#767676;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
  .issuebar a{color:${ACCENT}}
  /* The reading column. pageFromIssue() guarantees a .wrap exists (it injects
     one when the issue didn't bring its own), and this rule guarantees it
     means something: without a max-width, desktop body copy runs the full
     viewport — ~200 chars/line at 1280px — and no gate can see it. */
  .wrap{max-width:760px;margin:0 auto;padding:32px 24px 72px}
  @media(max-width:520px){.sitenav .in,.sitefoot,.issuebar{padding-left:16px;padding-right:16px}}
/* ---------- mobile typography ----------
   Issues are authored for a 760px desktop column and a Letter print page. This
   block is injected AFTER the issue's own <style>, so it wins on cascade order,
   and the !important flags appear only on font-size (issues use compound
   selectors like .frontpage .fp-h that would otherwise out-specify these).

   Reference points, not invention:
     · iOS HIG: 17pt for body text.  Material 3: 16sp preferred.
     · Never below 12px for anything that is not decorative; 14px for secondary text.
     · Line height 1.5–1.8 for small text; 1.2–1.3 for headings.
     · WCAG 2.5.8 (AA) touch targets 24x24 CSS px; 2.5.5 (AAA) 44x44; 8px apart.

   Breakpoint is 700px rather than 520px: 520 misses phones in landscape and
   larger handsets entirely. */
@media (max-width: 700px) {
  html { -webkit-text-size-adjust: 100%; }   /* stop iOS inflating text unpredictably */

  body { font-size: 17px !important; line-height: 1.62 !important; }
  .wrap { padding: 20px 17px 64px !important; }

  /* The one-page summary is the most-read thing on the site. Keep it largest. */
  .fp-h  { font-size: 20px !important; line-height: 1.3 !important; }
  .fp-p  { font-size: 16.5px !important; line-height: 1.58 !important; }
  .fp-where { font-size: 12.5px !important; line-height: 1.5 !important; }
  .fp-item { padding-bottom: 14px; margin-bottom: 14px; }
  .fp-rank { flex-basis: 26px; height: 26px; font-size: 13px; }
  .fp-cols { grid-template-columns: 1fr; gap: 12px; }
  .fp-mini { font-size: 14.5px !important; line-height: 1.5 !important; }
  .fp-box h4 { font-size: 12px !important; }

  /* Disclosure and attribution are the load-bearing promises of this
     publication. They must never be the smallest text on the page. */
  .aibar { font-size: 14px !important; line-height: 1.55 !important; padding: 12px 14px; }
  .aibar .badge { font-size: 10.5px !important; padding: 3px 7px; }
  .srcs  { font-size: 14px !important; }
  .srclist { font-size: 13.5px !important; line-height: 1.62 !important; padding-left: 20px; }
  .srclist .u { font-size: 12.5px !important; word-break: break-word; }
  sup.cite { font-size: 11px !important; }
  .caveat, .method p, .sec-note { font-size: 15px !important; line-height: 1.6 !important; }

  /* Headings: bigger, tighter. */
  h1.title { font-size: 40px !important; line-height: 1.05 !important; }
  h2.sec   { font-size: 13px !important; letter-spacing: .09em; }
  h3.story { font-size: 23px !important; line-height: 1.28 !important; }
  .lede    { font-size: 18px !important; line-height: 1.6 !important; }
  .stat .n { font-size: 30px !important; }
  .stat .l { font-size: 12.5px !important; }
  .dateline, .kicker { font-size: 12.5px !important; }

  /* Long URLs and long words must never force a sideways scroll. */
  .wrap, .srclist li, p { overflow-wrap: break-word; }

  /* Do NOT keep the nav stuck to the top on a phone: once links are 44px tall
     the bar wraps to two rows and permanently occupies an eighth of the screen
     on a publication whose entire purpose is one long read. It scrolls away. */
  .sitenav { position: static !important; backdrop-filter: none; }
  /* The AI-GENERATED chip is hidden on phones ONLY because the disclosure
     survives in more prominent places on the same screen and beyond: the .aibar
     directly below the masthead, the About page, the site footer, and every
     page of the PDF. Removing the chip does not reduce what the reader is told;
     keeping it would push the masthead below the fold. */
  .sitenav .ai { display: none; }
  .sitenav .in { flex-wrap: nowrap; padding: 4px 17px 6px; gap: 8px; }
  .sitenav nav { gap: 2px; margin-left: auto; }
  .sitenav nav a {
    min-height: 44px; display: inline-flex; align-items: center;
    padding: 0 6px; font-size: 15px !important;
    white-space: nowrap;   /* "Current issue" must not break across two lines */
  }
  .sitenav a.brand { white-space: nowrap; font-size: 19px; min-height: 44px;
    display: inline-flex; align-items: center; }
  /* 44px belongs on the primary nav. The issue bar gets a comfortable 34px,
     still above the WCAG 2.5.8 floor of 24, and stays on one wrapping line. */
  .issuebar a {
    min-height: 34px; display: inline-flex; align-items: center;
    padding: 0 2px; font-size: 14px !important;
  }
  .issuebar { gap: 0 12px; padding: 2px 17px 0; font-size: 13px !important; align-items: center; }
  .sitefoot { font-size: 14px !important; line-height: 1.65 !important; padding: 24px 17px 56px; }
  .sitefoot a { min-height: 32px; display: inline-block; }
}

/* Small handsets (375px and below): let the nav wrap to two rows rather than
   squeezing five nowrap items into a row that cannot hold them. */
@media (max-width: 380px) {
  h1.title { font-size: 34px !important; }
  .fp-h { font-size: 19px !important; }
  .sitenav .in { flex-wrap: wrap !important; }
  .sitenav nav { margin-left: 0; }
  .wrap { padding-left: 15px !important; padding-right: 15px !important; }
}
</style>
`;

function brandHtml(){
  if (cfg.domain) {
    const i = cfg.domain.indexOf('.');
    if (i > 0) return `${esc(cfg.domain.slice(0, i))}<span>${esc(cfg.domain.slice(i))}</span>`;
    return esc(cfg.domain);
  }
  return esc(cfg.siteName);
}

const nav = `
<div class="sitenav"><div class="in">
  <a class="brand" href="/">${brandHtml()}</a>
  <span class="ai">AI-generated</span>
  <nav>
    <a href="/">Current issue</a>
    <a href="/archive/">Archive</a>
    <a href="/about/">About</a>
    <a href="/feed.xml">RSS</a>
  </nav>
</div></div>`;

const siteFooter = (date) => `
<div class="sitefoot">
  <p><b>${esc(NAME)}</b>${cfg.domain ? ` · <a href="${SITE}">${esc(cfg.domain)}</a>` : ''} · ${esc(TAG)}</p>
  <p><b>This site is generated by an AI system and is not reviewed by a human editor.</b>
  It may contain errors. Every section names its sources — follow them and confirm with the
  primary authority before relying on anything here. Where this site and an official source
  disagree, the official source is correct. Nothing here is legal, financial, tax, real-estate
  or safety advice. <a href="/about/">Full method, limitations and corrections policy</a>.</p>
  <p>Published weekly on ${esc(cfg.publishDay)}s. <a href="/archive/">Past issues</a> · <a href="/feed.xml">RSS feed</a>${
    date ? ` · <a href="/issues/${date}.pdf">PDF of this issue</a>` : ''}</p>
${cfg.contactEmail ? `  <p><b>Spotted a mistake, or a source we should be reading?</b>
  <a href="${mailtoHref()}">${esc(cfg.contactEmail)}</a>.
  Corrections and source suggestions improve future issues; a person approves any new source
  before it is used. <b>This is not a mailing list</b> — writing in does not subscribe you to
  anything and nothing is ever sent to you. Please don't send personal information about anyone.</p>
` : ''}  <p>Independent and unaffiliated with any government body, civic association, or the businesses mentioned.</p>
</div>`;

function pageFromIssue(m, { pagePath, isLatest }) {
  let html = m.html;
  // Issues are "bare" in the sense of carrying no site chrome. Most are still
  // complete standalone documents (inline CSS, <head>, <body>); if one arrives
  // as a fragment without them, wrap it first — otherwise the chrome injections
  // below would silently no-op, which is exactly the class of invisible failure
  // this kit exists to prevent.
  if (!/<\/head>/i.test(html)) {
    html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(NAME)} — ${esc(longDate(m.date))}</title>
</head><body>
${html}
</body></html>`;
  }
  const canonical = SITE ? SITE + pagePath : '';
  html = html.replace('</head>', `${CHROME_CSS}
<link rel="alternate" type="application/rss+xml" title="${esc(NAME)}" href="/feed.xml">
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
<meta name="robots" content="index,follow">
<meta name="generator" content="${DISCLOSURE}">
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(NAME)} — ${esc(longDate(m.date))}">
<meta property="og:description" content="${esc(m.heads[0] || TAG)}">
<meta property="og:type" content="article">
${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
</head>`);
  const bar = `${nav}
<div class="issuebar">
  <span>Issue of <b>${longDate(m.date)}</b>${isLatest ? ' — current' : ''}</span>
  ${m.pdf ? `<a href="/issues/${m.pdf}">Download PDF</a>` : ''}
  <a href="/archive/">All issues</a>
</div>`;
  html = html.replace('<body>', `<body>\n${bar}`);
  html = html.replace('</body>', `${siteFooter(m.pdf ? m.date : null)}\n</body>`);
  // The reading column. The chrome CSS styles `.wrap` (max-width, mobile
  // padding) but an issue that doesn't carry its own would otherwise render
  // body copy at full viewport width — ~200 characters a line on a desktop
  // monitor, and no gate can see it (found by the first field instance, whose
  // first issue shipped that way). If the writer already emitted a .wrap,
  // leave it alone; if not, wrap everything between the issue bar and the
  // site footer. The chrome bar and footer stay full-bleed by design.
  if (!/class="[^"]*\bwrap\b/.test(html)) {
    html = html
      .replace(/(<div class="issuebar">[\s\S]*?<\/div>)/, `$1\n<div class="wrap">`)
      .replace(/<div class="sitefoot">/, `</div>\n<div class="sitefoot">`);
  }
  return outboundNewTab(html);
}

/* ---------- shell for generated pages (archive, about, 404, welcome) ---------- */
function shell({ title, desc, pagePath, body }) {
  const canonical = SITE && pagePath ? SITE + pagePath : '';
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(NAME)}" href="/feed.xml">
<meta name="generator" content="${DISCLOSURE}">
<style>
  :root{--ink:${INK};--ink-soft:#4a4a4a;--ink-faint:#767676;--rule:#d8d4cc;
    --rule-strong:#2b2b2b;--paper:${PAPER};--accent:${ACCENT};--amber:#8a5a12}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font-family:Georgia,"Iowan Old Style","Palatino Linotype",serif;font-size:17px;line-height:1.62}
  .wrap{max-width:760px;margin:0 auto;padding:30px 24px 40px}
  h1{font-size:clamp(28px,6vw,42px);line-height:1.05;margin:0 0 8px;font-weight:400;letter-spacing:-.02em}
  h2{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin:34px 0 4px}
  .rule{height:2px;background:var(--rule-strong);margin-bottom:14px}
  .lead{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 26px}
  p{margin:0 0 14px}
  a{color:var(--accent);text-decoration:none;border-bottom:1px solid ${ACCENT}47}
  a:hover{border-bottom-color:var(--accent)}
  .issue{border-bottom:1px solid var(--rule);padding:16px 0}
  .issue h3{margin:0 0 4px;font-size:20px;font-weight:400}
  .issue h3 a{border-bottom:none}
  .issue .d{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);font-weight:700}
  .issue ul{margin:8px 0 0;padding-left:18px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:14px;line-height:1.5;color:var(--ink-soft)}
  .issue li{margin-bottom:3px}
  .issue .links{margin-top:8px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-size:13px}
  .warn{background:#fdf6e8;border:1px solid #e3d3ae;border-left:3px solid var(--amber);
    border-radius:2px;padding:12px 14px;margin:0 0 24px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:13.5px;line-height:1.5;color:#5c4a22}
  .warn b{color:#3d3115}
  .body-copy{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
    font-size:15px;line-height:1.62;color:var(--ink-soft)}
  .body-copy b{color:var(--ink)}
${CHROME_CSS.replace(/<\/?style[^>]*>/g,'')}
</style>
</head><body>
${nav}
<div class="wrap">${outboundNewTab(body)}</div>
${siteFooter(null)}
</body></html>`;
}

/* ---------- write output ---------- */
// Wipe public/ for a clean build where that is allowed. Some sandboxed VMs
// mount this folder WITHOUT delete permission, so rmSync throws EPERM there —
// fall back to overwriting in place, which is sufficient because every output
// file is rewritten on each run.
if (existsSync(OUT)) {
  try { rmSync(OUT, { recursive: true }); }
  catch (e) {
    if (e.code !== 'EPERM' && e.code !== 'EACCES') throw e;
    console.log('  note: cannot delete public/ here (read-only-delete mount) — overwriting in place');
  }
}
mkdirSync(OUT, { recursive: true });
mkdirSync(path.join(OUT, 'issues'), { recursive: true });

const latest = meta[0] || null;

if (latest) {
  // Latest issue at / and every issue at /YYYY-MM-DD/
  writeFileSync(path.join(OUT, 'index.html'),
    pageFromIssue(latest, { pagePath: '/', isLatest: true }));
  for (const m of meta) {
    const dir = path.join(OUT, m.date);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'),
      pageFromIssue(m, { pagePath: `/${m.date}/`, isLatest: m.date === latest.date }));
    if (m.pdf) copyFileSync(path.join(SRC, m.pdf), path.join(OUT, 'issues', m.pdf));
  }
} else {
  // No issues yet: a fresh clone must still produce a serving site, so the
  // onboarding path can deploy and smoke-test BEFORE the first issue exists.
  writeFileSync(path.join(OUT, 'index.html'), shell({
    title: NAME, desc: TAG, pagePath: '/',
    body: `<h1>${esc(NAME)}</h1>
<p class="lead">${esc(TAG)}</p>
<div class="warn"><b>When issues publish here, they will be AI-generated and not reviewed by a
human editor.</b> Every claim will name its source — the promise of this publication is that you
can always check its work.</div>
<div class="body-copy">
<p><b>The first issue has not been published yet.</b> This site is up and serving, which means
the publishing pipeline is working — the first edition arrives with the next weekly run.</p>
<p>Read <a href="/about/">how this publication works</a>, or subscribe to the
<a href="/feed.xml">RSS feed</a> now and the first issue will find you when it lands.</p>
</div>` }));
}

// Archive
const archiveBody = `
<h1>Archive</h1>
<p class="lead">Every issue of ${esc(NAME)}</p>
<div class="warn"><b>All issues are AI-generated and unreviewed.</b> Older issues are kept as
published and are <b>not</b> corrected or updated — figures, dates and legal status in a past
issue may since have changed. Check the issue date before using anything.</div>
${meta.length ? meta.map(m => `<div class="issue">
  <div class="d">${longDate(m.date)}${m.vol ? ' · ' + esc(m.vol) : ''}</div>
  <h3><a href="/${m.date}/">Issue of ${longDate(m.date)}</a></h3>
  ${m.heads.length ? `<ul>${m.heads.slice(0,5).map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
  <div class="links"><a href="/${m.date}/">Read online</a>${m.pdf ? ` · <a href="/issues/${m.pdf}">PDF</a>` : ''}</div>
</div>`).join('\n')
  : `<div class="body-copy"><p>No issues yet — the first one will appear here when it publishes.</p></div>`}`;
mkdirSync(path.join(OUT, 'archive'), { recursive: true });
writeFileSync(path.join(OUT, 'archive', 'index.html'),
  shell({ title: `Archive — ${NAME}`, desc: `Past issues of ${NAME}`,
          pagePath: '/archive/', body: archiveBody }));

// About / disclosure — template prose any town can ship; identity from config.
const beats = (cfg.sections || [])
  .filter(s => !/week in one page|mark your calendar/i.test(s));
const aboutBody = `
<h1>About ${esc(NAME)}</h1>
<p class="lead">What this is, how it is made, and what it is not</p>

<div class="warn"><b>This publication is written by an AI system and is not reviewed by a human
editor or fact-checker before publication.</b> It may state incorrect things in confident,
fluent prose. Treat it as a set of leads to verify, not a record of fact.</div>

<div class="body-copy">
${cfg.experimental ? `<h2>Why "Experimental"</h2>
<div class="rule"></div>
<p>The word is in the name deliberately, and it is not decoration. This brief is written
end to end by an AI system with no human editor between the draft and the page, and
nobody yet knows two things about it: whether it is <b>useful</b> — whether it surfaces
what a neighbor actually wants to know rather than what happens to be in a public
dataset — and whether it is <b>accurate</b> enough to be worth reading, which means
checking its claims against the sources beside them over a run of issues rather than
assuming a fluent paragraph is a correct one.</p>
<p>Those are empirical questions, and answering them takes readers. Until they are
answered, "Experimental" is the honest label: read it as a set of leads, follow the
sources${cfg.contactEmail ? `, and <a href="${mailtoHref()}">tell us when it is wrong</a>` : ''}.
The word comes off the masthead when the accuracy record earns it, not on a schedule.</p>
` : ''}
<h2>What it is</h2>
<div class="rule"></div>
<p><b>${esc(cfg.siteName)}</b> is a weekly brief on <b>ZIP code ${esc(cfg.zip)}</b> — ${esc(cfg.city)}, ${esc(cfg.state)}.
Standing coverage includes ${esc(beats.slice(0, -1).join(', ').toLowerCase())}${beats.length > 1 ? ', and ' + esc(beats[beats.length-1].toLowerCase()) : ''}.</p>
<p>It is written for <b>everyone in the ZIP code</b> — owners and renters, longtime residents and
newcomers, families and people without children, commuters, retirees, and local business. Coverage
is deliberately framed around what a change means for residents generally rather than for any one
group; where an item genuinely affects only one of them, the writing says so rather than assuming
it of everyone. It is independent, free, carries no advertising, and is unaffiliated with any
government body, civic association, or business mentioned.</p>

<h2>How it is made</h2>
<div class="rule"></div>
<p>Each issue is researched, written and formatted by an AI system (Claude, made by Anthropic)
working from public sources: government open-data APIs, agency websites, civic association
postings, school pages, and local news outlets. <b>No human reporter, editor or fact-checker
reviews an issue before it publishes.</b> There is no newsroom, no editorial board, and no
professional indemnity behind it.</p>
<p>Every section of every issue ends with its own <b>Sources</b> line naming the specific pages,
datasets and documents behind its claims, with query dates for figures drawn from databases, plus
the accuracy caveats that apply to that particular material. Where something could not be
verified, the issue says so rather than smoothing it over.</p>

<h2>What AI gets wrong</h2>
<div class="rule"></div>
<p>AI systems misread tables, transpose digits, conflate similar entities, carry stale information
forward, and — most dangerously — state incorrect things fluently and confidently. Recurring
hazards in local material specifically: crime counts are preliminary and get reclassified; school
and league pages are frequently out of date at the source; monthly real-estate medians over small
samples swing on a single unusual sale; event dates in local coverage are often approximate; and
some sources publish only as PDFs that cannot be read reliably, leaving gaps that are disclosed
in the issue.</p>
${cfg.geographyNote ? `
<h2>Geographies and their limits</h2>
<div class="rule"></div>
<p>${esc(cfg.geographyNote)}</p>
` : ''}
<h2>How to use it</h2>
<div class="rule"></div>
<p><b>Follow the source links.</b> Before acting on anything here — attending a meeting, filing an
appeal, making a travel plan, drawing a conclusion about neighborhood safety, or making a
financial decision — confirm it with the primary authority. <b>Where this publication and an
official source disagree, the official source is correct and this publication is wrong.</b></p>

<h2>Not professional advice</h2>
<div class="rule"></div>
<p>Nothing here is legal, financial, tax, real-estate, or safety advice. Property tax and
assessment content is general information, not tax advice. Real-estate figures are estimates over
small samples and are not an appraisal or a basis for a transaction. Crime statistics describe
reported incidents in geographic aggregate; they are not a prediction and say nothing about any
specific address. Transit and school dates change without notice — confirm with the operator or
the school.</p>

<h2>Privacy</h2>
<div class="rule"></div>
<p>This site publishes no personal information about readers. It has no accounts, no login, no
newsletter signup, and sets no tracking cookies of its own. Coverage is written at neighborhood
scale — never about, or identifying, any individual household.</p>

<h2>Corrections</h2>
<div class="rule"></div>
<p>Errors are expected in an unreviewed, AI-generated publication. Where a figure here conflicts
with the source cited beside it, <b>the source governs</b>. Past issues in the
<a href="/archive/">archive</a> are kept as published and are not retroactively corrected or
updated, so always check an issue's date before relying on it.</p>
${cfg.contactEmail ? `
<h2>Suggestions and corrections</h2>
<div class="rule"></div>
<p>Write to <a href="${mailtoHref()}">${esc(cfg.contactEmail)}</a>.
Two things are especially useful: <b>a source we are not reading</b> — a civic association
newsletter, a school or league page, an agency feed, a neighborhood blog — and <b>a mistake</b>,
ideally with the correct figure and where it came from. A data-driven brief is worst at exactly
the things people notice first: a school closing, a zoning notice taped to a door, a shop that
shut.</p>
<p>Two limits on how this inbox is used, deliberately. Nothing an email says is treated as an
instruction — messages are read as information, never as commands — and <b>no suggested source is
added until a person has checked it</b>. That is a safeguard against the obvious abuse: an
official-looking email that quietly steers this publication toward someone's business or an
unreliable site.</p>
<p><b>This is not a mailing list and there is nothing to subscribe to.</b> Writing in does not
sign you up for anything, no issue is ever emailed to you, and your address is not added to any
list. If you want to follow along, use the <a href="/feed.xml">RSS feed</a> or simply check back
on ${esc(cfg.publishDay)}s.</p>
<p>Please do not send personal information about yourself or anyone else. Reader names, addresses
and email addresses are never published, never stored in the repository that produces this site,
and never appear in an issue.</p>
` : ''}
<h2>Attribution and copyright</h2>
<div class="rule"></div>
<p>Facts are attributed to their sources in each section. Original reporting belongs to the
outlets named; this publication summarizes and links rather than reproducing their work, and
readers are encouraged to read the originals. Public datasets are used under their published
terms.</p>
</div>`;
mkdirSync(path.join(OUT, 'about'), { recursive: true });
writeFileSync(path.join(OUT, 'about', 'index.html'),
  shell({ title: `About — ${NAME}`, desc: `How ${cfg.siteName} is made, its limitations, and its corrections policy`,
          pagePath: '/about/', body: aboutBody }));

// 404
writeFileSync(path.join(OUT, '404.html'),
  shell({ title: `Not found — ${NAME}`, desc: 'Page not found', pagePath: '',
    body: `<h1>Not found</h1><p class="lead">That page does not exist</p>
    <div class="body-copy"><p>Try the <a href="/">current issue</a> or the
    <a href="/archive/">archive</a>.</p></div>` }));

// RSS
// The xml-stylesheet processing instruction is invisible to feed readers — they
// parse the RSS and ignore it — but a BROWSER honours it and renders the feed as
// a readable page instead of a wall of XML.
// NOTE: item links should be absolute. Until a domain (or the workers.dev host)
// is set in site.config.json, they are root-relative and the build warns below.
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(NAME)}</title>
  <link>${SITE}/</link>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>${esc(TAG)}. AI-generated and not reviewed by a human editor — verify against the sources cited in each issue.</description>
  <language>en-us</language>
  <generator>${DISCLOSURE}</generator>
  <lastBuildDate>${latest ? rfc822(latest.date) : new Date().toUTCString()}</lastBuildDate>
${meta.map(m => `  <item>
    <title>${esc(NAME)} — ${esc(longDate(m.date))}</title>
    <link>${SITE}/${m.date}/</link>
    <guid isPermaLink="true">${SITE}/${m.date}/</guid>
    <pubDate>${rfc822(m.date)}</pubDate>
    <description>${esc(
      'AI-generated; not reviewed by a human editor — verify against the sources cited in the issue. In this issue: '
      + (m.heads.slice(0,5).join(' · ') || 'see issue')
    )}</description>
  </item>`).join('\n')}
</channel>
</rss>`;
writeFileSync(path.join(OUT, 'feed.xml'), rss);

/* ---------- human-readable view of the feed ----------
   XSLT 1.0, which every current browser still supports for XML documents. It only
   affects what a person sees when they open /feed.xml directly; the bytes a feed
   reader consumes are unchanged and still valid RSS 2.0. */
writeFileSync(path.join(OUT, 'feed.xsl'), `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
<xsl:output method="html" encoding="UTF-8" doctype-system="about:legacy-compat"/>
<xsl:template match="/rss/channel">
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><xsl:value-of select="title"/> — RSS feed</title>
<style>
 body{background:${PAPER};color:${INK};margin:0;
   font:17px/1.62 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
   -webkit-text-size-adjust:100%}
 .w{max-width:720px;margin:0 auto;padding:30px 20px 70px}
 h1{font-family:Georgia,serif;font-size:30px;font-weight:400;margin:0 0 6px}
 .sub{color:#767676;font-size:15px;margin-bottom:22px}
 .box{background:#fff8e8;border-left:3px solid #8a5a12;padding:13px 16px;font-size:15px;margin-bottom:26px}
 .box b{color:#8a5a12}
 .u{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;
   background:#f0ece4;padding:3px 7px;border-radius:3px;word-break:break-all;display:inline-block}
 h2{font-size:14px;letter-spacing:.07em;text-transform:uppercase;color:${ACCENT};
   margin:30px 0 10px;border-bottom:2px solid ${INK};padding-bottom:6px}
 .it{border-bottom:1px solid #d8d4cc;padding:14px 0}
 .it a{font-family:Georgia,serif;font-size:20px;color:${INK};text-decoration:none;line-height:1.3}
 .it a:hover{color:${ACCENT}}
 .d{color:#767676;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;margin:5px 0 7px}
 .x{color:#4a4a4a;font-size:15.5px;line-height:1.55}
 footer{margin-top:34px;font-size:14px;color:#767676}
 footer a,.box a{color:${ACCENT}}
 @media(max-width:700px){.w{padding:22px 17px 60px}}
</style>
</head><body><div class="w">
<h1><xsl:value-of select="title"/></h1>
<div class="sub"><xsl:value-of select="description"/></div>

<div class="box"><b>This is an RSS feed, not a web page.</b> Paste the address below into a
news reader — NetNewsWire, Feedly, Reeder, Thunderbird — and it will show you each new
issue automatically. There is nothing to sign up for and no email is involved.
<div style="margin-top:9px"><span class="u"><xsl:value-of select="atom:link/@href"/></span></div>
</div>

<h2><xsl:value-of select="count(item)"/> issue(s) in this feed</h2>
<xsl:for-each select="item">
  <div class="it">
    <a><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute><xsl:value-of select="title"/></a>
    <div class="d"><xsl:value-of select="pubDate"/></div>
    <div class="x"><xsl:value-of select="description"/></div>
  </div>
</xsl:for-each>

<footer>
  <a><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>Read the current issue on the web</a>
</footer>
</div></body></html>
</xsl:template>
</xsl:stylesheet>
`);

// sitemap / robots — a sitemap of relative URLs is invalid, so it is only
// written once a domain is configured.
if (SITE) {
  writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc></url>
  <url><loc>${SITE}/archive/</loc></url>
  <url><loc>${SITE}/about/</loc></url>
${meta.map(m => `  <url><loc>${SITE}/${m.date}/</loc><lastmod>${m.date}</lastmod></url>`).join('\n')}
</urlset>`);
}
writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ''}`);

// Cloudflare headers + redirects
writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'none'; frame-ancestors 'self'
  X-Robots-Tag: all
/issues/*
  Cache-Control: public, max-age=31536000, immutable
/feed.xml
  Content-Type: application/rss+xml; charset=utf-8
  Cache-Control: public, max-age=3600
/feed.xsl
  Content-Type: text/xsl; charset=utf-8
  Cache-Control: public, max-age=86400
/
  Cache-Control: public, max-age=900
`);
writeFileSync(path.join(OUT, '_redirects'), `# Convenience URLs
/latest              /                     302
/rss                 /feed.xml             301
/feed                /feed.xml             301
/issues              /archive/             301
/pdf                 ${latest?.pdf ? `/issues/${latest.date}.pdf` : '/archive/'}   302
`);

console.log(`built ${meta.length} issue(s) -> public/`);
if (latest) {
  console.log(`  latest: ${latest.date}${latest.pdf ? ' (with PDF)' : ' (no PDF found)'}`);
  for (const m of meta) console.log(`  /${m.date}/  ${m.heads.length} front-page items${m.pdf ? ' + PDF' : ''}`);
} else {
  console.log('  no issues yet — wrote the "first issue coming soon" homepage');
}
if (!SITE) {
  console.log('  ::warning::site.config.json has no domain — canonical URLs, sitemap and absolute');
  console.log('  feed links are disabled. After your first deploy, set "domain" to your');
  console.log('  <worker>.<account>.workers.dev host (or your custom domain) and rebuild.');
}
