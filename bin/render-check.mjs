// render-check — assert the issue LOOKS right, not just that its markup exists.
//
//   node bin/render-check.mjs [file.html]        (default: fixtures/styled-issue.html)
//
// Why this exists. Every other gate in this kit checks what is checkable in
// text: disclosure strings, citation structure, privacy patterns, the presence
// of markup. **Presence is not appearance.** The reference stylesheet once
// shipped a specificity inversion — `.fp-item > div { flex: 1 }` (0,1,1) beating
// `.fp-rank` (0,1,0), because the brief's own template makes both the rank badge
// and the body `> div` children — so the 30px circular rank badge computed to
// 373px wide and rendered as a maroon lozenge across a third of the column, on
// every front-page item of every issue. `verify-issue` confirmed
// `<div class="fp-rank">` was present. Eight automated checks and a human
// reading the HTML source all passed it. A publication whose credibility rests
// on looking like a serious local paper cannot leave that class of failure
// entirely to chance.
//
// It uses Playwright, which the kit already depends on for the PDF. If the
// browser is not installed this SKIPS with instructions and exits 0 — a missing
// optional browser must never block a publisher, but a browser that IS present
// must be used.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/config.mjs';

const target = process.argv[2] ?? join(ROOT, 'fixtures', 'styled-issue.html');
if (!existsSync(target)) {
  console.error(`render-check: ${target} not found`);
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('render-check: playwright not installed — SKIPPED.');
  console.log('  npm install && npx playwright install chromium   (then re-run)');
  process.exit(0);
}

let browser;
try {
  browser = await chromium.launch();
} catch (err) {
  console.log('render-check: Chromium not installed — SKIPPED.');
  console.log('  npx playwright install chromium   (then re-run)');
  console.log(`  (${String(err.message).split('\n')[0]})`);
  process.exit(0);
}

const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto(pathToFileURL(target).href);

const measured = await page.evaluate(() => {
  const one = sel => document.querySelector(sel);
  const css = (el, ...props) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return Object.fromEntries(props.map(p => [p, s[p]]));
  };
  const rankEl = one('.fp-rank');
  const rankBox = rankEl?.getBoundingClientRect();
  // Compare each element against the text it actually SITS IN, not against
  // document.body: a label inside a 16px paragraph "differs" from a 17px body
  // while being visually identical to its surroundings. The question is whether
  // a reader can tell it apart from the prose around it.
  const withParent = sel => {
    const el = one(sel);
    if (!el) return null;
    const props = ['fontSize', 'color', 'fontWeight', 'textTransform'];
    return { self: css(el, ...props), parent: css(el.parentElement, ...props) };
  };
  return {
    rank: rankBox ? { w: Math.round(rankBox.width), h: Math.round(rankBox.height) } : null,
    rankRadius: css(rankEl, 'borderRadius')?.borderRadius ?? null,
    lbl: withParent('.lbl'),
    where: withParent('.fp-where'),
    present: {
      lbl: !!one('.lbl'), where: !!one('.fp-where'), rank: !!rankEl,
    },
  };
});
await browser.close();

const fails = [];
const notes = [];

// 1. The rank badge must be a circle. This is the specificity inversion.
if (!measured.present.rank) {
  fails.push('no .fp-rank rendered — the front-page template requires a rank badge on every item.');
} else {
  const { w, h } = measured.rank;
  if (Math.abs(w - h) > 2) {
    fails.push(
      `.fp-rank renders ${w}x${h}px — it must be a circle (square box + 50% radius). ` +
      `A wider-than-tall badge means a rule with higher specificity is overriding its flex-basis: ` +
      `check that ".fp-item > .fp-rank { flex: 0 0 30px; }" follows ".fp-item > div { flex: 1; }" ` +
      `in fixtures/house-style.css. Shipped once as a 373px lozenge on every item.`);
  } else {
    notes.push(`.fp-rank ${w}x${h}px, radius ${measured.rankRadius} — circular`);
  }
}

// 2. Elements the brief REQUIRES to read differently from body text must actually
//    do so, in at least one of size / weight / colour / transform. "Why it
//    matters:" rendering as plain body text is the brief's rule silently undone.
const distinct = (name, m) => {
  if (!m) { notes.push(`.${name} not present in this fixture — skipped`); return; }
  const { self, parent } = m;
  const differs =
    self.fontSize !== parent.fontSize ||
    self.fontWeight !== parent.fontWeight ||
    self.color !== parent.color ||
    (self.textTransform !== parent.textTransform && self.textTransform !== 'none');
  if (!differs) {
    fails.push(
      `.${name} computes identical to the text it sits in (${self.fontSize}, ${self.fontWeight}, ` +
      `${self.color}) — it must differ in at least one of size, weight, colour or transform, or ` +
      `the distinction the brief requires is invisible to readers. Add a rule to ` +
      `fixtures/house-style.css.`);
  } else {
    notes.push(`.${name} distinct from its surrounding text (${self.fontSize}/${self.fontWeight}/${self.color}${self.textTransform !== 'none' ? '/' + self.textTransform : ''})`);
  }
};
distinct('lbl', measured.lbl);
distinct('fp-where', measured.where);

console.log(`render-check — ${target.replace(ROOT + '/', '')}`);
for (const n of notes) console.log(`  ok   ${n}`);
for (const f of fails) console.error(`::error::${f}`);
if (fails.length) {
  console.error(`\nrender-check FAILED — ${fails.length} appearance problem(s). ` +
    `Markup presence is not appearance; these are what a reader sees first.`);
  process.exit(1);
}
console.log(`\nrender-check passed — the issue renders as designed.`);
