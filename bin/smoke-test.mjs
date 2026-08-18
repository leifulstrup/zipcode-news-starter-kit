#!/usr/bin/env node
/**
 * smoke-test.mjs — is the published site actually working?
 *
 *   node bin/smoke-test.mjs --base https://your-site.example [--week YYYY-MM-DD]
 *
 * The weekly workflow proves the issue was BUILT. It cannot prove the issue was
 * DEPLOYED, because the host builds asynchronously after the commit — the run is
 * long finished by the time the site changes. Everything after `git push` is
 * unobserved without this. It is the only check in the kit that looks at what a
 * reader actually sees.
 *
 * The home page is the whole product: if it 200s but has lost its AI disclosure
 * or its sources, that is a WORSE failure than a 500, because nothing looks
 * broken. Hence the content assertions, not just status codes.
 */
import { loadConfig, displayName } from './lib/config.mjs';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const config = loadConfig();

const BASE = (arg('--base', config.domain ? `https://${config.domain}` : null) || '').replace(/\/$/, '');
if (!BASE) {
  console.error('smoke-test: no --base given and site.config.json has no domain.');
  console.error('Pass the live URL explicitly, e.g.:');
  console.error('  node bin/smoke-test.mjs --base https://<workerName>.<account>.workers.dev');
  process.exit(2);
}
const WEEK = arg('--week', null);

// A fresh site's first issue may be modest; this floor catches an empty shell,
// not a short edition. Raise it once you know your typical size.
const MIN_HOME_BYTES = 15000;

const results = [];
const check = async (label, path, test) => {
  const url = BASE + path;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const body = await r.text();
    const problem = await test({ r, body, url });
    results.push({ label, path, status: r.status, ok: !problem, problem });
  } catch (e) {
    results.push({ label, path, status: 0, ok: false, problem: e.message });
  }
};

const is = (r, code) => r.status === code ? null : `expected ${code}, got ${r.status}`;
const hasType = (r, want) => (r.headers.get('content-type') || '').includes(want)
  ? null : `content-type is "${r.headers.get('content-type')}", expected ${want}`;

await check('home', '/', ({ r, body }) =>
  is(r, 200)
  || (body.includes('aibar') ? null : 'no .aibar AI-disclosure block')
  || (/not reviewed by a human editor/i.test(body) ? null : 'missing "not reviewed by a human editor"')
  || (body.includes(displayName(config)) ? null : `masthead does not say "${displayName(config)}"`)
  || (body.length > MIN_HOME_BYTES ? null : `only ${body.length} bytes — suspiciously short for an issue`));

await check('archive', '/archive/', ({ r, body }) => is(r, 200) || (/Issue of/.test(body) ? null : 'archive lists no issues'));

await check('about', '/about/', ({ r, body }) => is(r, 200)
  // The contact assertion exists to prove a reader can write in — only when a
  // contact route is configured at all.
  || (!config.contactEmail ? null
      : (body.includes(`mailto:${config.contactEmail}`) ? null : 'no feedback mailto on the About page')));

await check('rss', '/feed.xml', ({ r, body }) => is(r, 200) || hasType(r, 'xml') || (/<item>/.test(body) ? null : 'feed has no items'));
await check('sitemap', '/sitemap.xml', ({ r }) => is(r, 200) || hasType(r, 'xml'));
await check('robots', '/robots.txt', ({ r }) => is(r, 200));
await check('404 is a real 404', '/no-such-page-please', ({ r }) => is(r, 404));
await check('shortcut /latest', '/latest', ({ r }) => is(r, 200));
await check('shortcut /rss', '/rss', ({ r }) => is(r, 200) || hasType(r, 'xml'));
await check('shortcut /pdf', '/pdf', ({ r }) => is(r, 200) || hasType(r, 'pdf'));

// The week under test, when given: permalink, PDF, and presence in archive + feed.
if (WEEK) {
  await check(`permalink ${WEEK}`, `/${WEEK}/`, ({ r, body }) => is(r, 200) || (body.includes(WEEK) ? null : 'page does not mention its own date'));
  await check(`pdf ${WEEK}`, `/issues/${WEEK}.pdf`, ({ r }) => is(r, 200) || hasType(r, 'pdf'));
  await check(`archive lists ${WEEK}`, '/archive/', ({ r, body }) => is(r, 200) || (body.includes(WEEK) ? null : `archive is missing ${WEEK}`));
  await check(`feed lists ${WEEK}`, '/feed.xml', ({ r, body }) => is(r, 200) || (body.includes(WEEK) ? null : `feed is missing ${WEEK}`));
}

const bad = results.filter(x => !x.ok);
for (const x of results) console.log(`${x.ok ? ' ok ' : 'FAIL'}  ${String(x.status).padEnd(3)} ${x.path.padEnd(28)} ${x.label}${x.ok ? '' : ' — ' + x.problem}`);
console.log(`\n${results.length - bad.length}/${results.length} passed against ${BASE}`);
if (bad.length) {
  for (const x of bad) console.log(`::error::${x.path} — ${x.problem}`);
  process.exit(1);
}
