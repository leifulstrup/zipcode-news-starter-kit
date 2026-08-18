#!/usr/bin/env node
/* Convert an HTML edition to a print-quality PDF.
 *
 *   node bin/html-to-pdf.mjs <input.html> <output.pdf> "<footer text>"
 *
 * Uses Chromium's own print engine so the newsletter's design is preserved
 * rather than rebuilt. Do NOT swap this for a PDF library that re-authors the
 * layout — the whole point is that the PDF is the same document readers see on
 * the web.
 *
 * Notes learned the hard way in the reference deployment:
 *  - page.pdf() needs FULL chromium, not chrome-headless-shell. A bare
 *    chromium.launch() can pick the headless shell and fail.
 *  - The browser path is ENVIRONMENT-SPECIFIC and must not be hardcoded. On a
 *    GitHub runner `npx playwright install chromium` puts it under
 *    ~/.cache/ms-playwright; in other sandboxes it lives elsewhere. Set
 *    PLAYWRIGHT_CHROMIUM_PATH to override; otherwise let Playwright resolve its
 *    own download, which is right on CI.
 *  - The tuning constants in the print CSS below control how many pages the
 *    edition runs. Loosening body font-size or section margin can strand the
 *    footer onto a page of its own.
 *  - The AI disclosure must survive into the PDF: it rides in the running
 *    footer on every page AND in the PDF's Title metadata (Chromium copies
 *    document.title into the PDF /Title field).
 */
import { readFileSync } from 'node:fs';
import { loadConfig, displayName } from './lib/config.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright is not installed. Run:');
  console.error('  npm install && npx playwright install chromium');
  process.exit(1);
}

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) {
  console.error('usage: node bin/html-to-pdf.mjs <input.html> <output.pdf> "<footer text>"');
  process.exit(2);
}

const cfg = loadConfig();
const DISCLOSURE = 'AI-generated; not reviewed by a human editor';
const footerText = process.argv[4] || `${displayName(cfg)} — ${DISCLOSURE}`;

const accent = cfg.colors?.accent || '#7a2e2e';

const printCSS = `
<style id="print-rules">
@page { size: Letter; margin: 0.5in 0.55in; }
@media print {
  html, body { background:#fff !important; }
  body { font-size: 10.4pt; line-height: 1.52; }   /* tuned: page-count control */
  .wrap { max-width:none !important; padding:0 !important; }

  /* Units that must never split across a page break */
  .story-wrap, .lede, .stat, .cal-row, .bar, .caveat,
  .briefs li, .stats, .bars, .cal, .fp-item, .fp-box { break-inside: avoid; page-break-inside: avoid; }
  footer { break-inside: avoid; }

  p { orphans: 3; widows: 3; }

  /* A heading must never be the last thing on a page */
  h2.sec, h3.story, .sec-rule, .sec-note { break-after: avoid; page-break-after: avoid; }
  .masthead { break-after: avoid; }
  section { break-inside: auto; margin-bottom: 21px; }  /* tuned */

  .story-wrap { margin-bottom:18px; padding-bottom:18px; }
  .lede { margin-bottom:26px; }
  h1.title { font-size:40pt; }
  h3.story { font-size:15pt; }
  .stat .n { font-size:19pt; }

  a { color:${accent} !important; border-bottom:none !important; }
  /* A printed page cannot be clicked, so the contact address has to be readable
     as text as well as being a live annotation in the PDF. */
  a[href^="mailto:"] { color:${accent} !important; font-weight:600; }

  .briefs { column-count:2; column-gap:26px; }
  .briefs li { font-size:10pt; }

  .caveat { font-size:9pt; padding:12px 14px; margin-bottom:16px; }
  footer { font-size:8.6pt; padding-top:14px; }
  footer ul { column-count:2; column-gap:22px; margin-bottom:10px; }
  footer li { margin-bottom:3px; break-inside:avoid; }
}
</style>`;

let html = readFileSync(src, 'utf8').replace('</head>', printCSS + '\n</head>');

// Chromium writes document.title into the PDF's /Title metadata. Make sure the
// disclosure is in it: a PDF forwarded around detached from the site must still
// say what wrote it.
if (/<title>[\s\S]*?<\/title>/i.test(html)) {
  html = html.replace(/<title>([\s\S]*?)<\/title>/i, (m, t) =>
    t.includes(DISCLOSURE) ? m : `<title>${t} — ${DISCLOSURE}</title>`);
} else {
  html = html.replace('</head>', `<title>${displayName(cfg)} — ${DISCLOSURE}</title>\n</head>`);
}

const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH;
let browser;
try {
  browser = await chromium.launch(explicit ? { executablePath: explicit } : {});
} catch (err) {
  // The package being installed does not mean the browser is. This is the first
  // wall a fresh machine hits, so the message must say exactly what to type.
  console.error('html-to-pdf: could not launch Chromium.');
  console.error('  Most likely the browser binary is not installed (the playwright');
  console.error('  npm package and the browser download are separate steps). Run:');
  console.error('      npx playwright install chromium');
  console.error('  and re-run this script. To use a Chromium you already have,');
  console.error('  set PLAYWRIGHT_CHROMIUM_PATH to its executable.');
  console.error(`  (underlying error: ${String(err.message || err).split('\n')[0]})`);
  process.exit(1);
}
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: out,
  format: 'Letter',
  printBackground: true,
  margin: { top: '0.5in', bottom: '0.6in', left: '0.55in', right: '0.55in' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-family:-apple-system,Helvetica,Arial,sans-serif;
     font-size:7.5pt;color:#8a8a8a;padding:0 0.55in;display:flex;justify-content:space-between">
       <span>${footerText}</span>
       <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
     </div>`
});
await browser.close();
console.log('wrote', out);
