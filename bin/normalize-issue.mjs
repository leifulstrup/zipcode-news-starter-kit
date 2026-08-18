#!/usr/bin/env node
/**
 * bin/normalize-issue.mjs — rewrite issues/<WEEK>.html in place so the raw issue,
 * the PDF and the built site all behave identically.
 *
 *   node bin/normalize-issue.mjs issues/2026-01-02.html
 *
 * WHY IT LIVES HERE AND NOT IN build.mjs. If this transform lived in build.mjs it
 * would only reach the *website*. But the PDF is rendered from the bare issue, and
 * the workflow artifact IS the bare issue — so a reader of the PDF, or the editor
 * reading the artifact, would get untransformed markup. Anything that must be true
 * of "the issue" belongs upstream of every consumer, not inside one of them.
 *
 * Two transforms, both idempotent:
 *
 * 1. EMAIL -> mailto. A bare contact address in text is dead on a web page and
 *    dead in a PDF. Chromium's print engine turns real <a> elements into PDF
 *    link annotations, so writing the anchor here is what makes the address
 *    clickable in Preview, Acrobat and every other reader. Skipped entirely when
 *    site.config.json has no contactEmail.
 *
 * 2. OUTBOUND LINKS -> new tab. A publication whose entire claim is "verify this
 *    against the source" must not charge you your place in the issue to follow
 *    one. Internal links and the site's own hosts are left alone. rel="noopener
 *    noreferrer" is mandatory, not decorative: target="_blank" without it hands
 *    the opened page a live handle on ours via window.opener.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig, loadSources } from './lib/config.mjs';

const cfg = loadConfig();
const sources = loadSources();

const EMAIL = cfg.contactEmail || '';
const SUBJECT = encodeURIComponent(`${cfg.siteName} — suggestion or correction`);
// Hosts that count as "us": the configured domain plus everything in
// config/sources.json `self` (the workers.dev host belongs there).
const SELF_HOSTS = [cfg.domain, ...sources.self].filter(Boolean).map(h => h.toLowerCase());

/** Bare email text -> mailto anchor. Skips anything already inside an <a>. */
export function linkifyEmail(html) {
  if (!EMAIL) return html;
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/i);   // keep tags+anchors intact
  return parts.map((chunk, i) => {
    if (i % 2 === 1) return chunk;                                   // a tag or a whole anchor
    return chunk.replace(new RegExp(EMAIL.replace(/[.+]/g, m => '\\' + m), 'g'),
      `<a href="mailto:${EMAIL}?subject=${SUBJECT}">${EMAIL}</a>`);
  }).join('');
}

/** Off-site links open in a new tab, safely. */
export function outboundNewTab(html) {
  return html.replace(/<a\s+([^>]*?)>/gi, (tag, attrs) => {
    const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
    if (!/^https?:\/\//i.test(href)) return tag;            // relative, anchor, mailto
    try {
      const host = new URL(href).host.toLowerCase();
      if (SELF_HOSTS.some(self => host === self || host.endsWith('.' + self))) return tag;
    } catch { return tag; }
    if (/\btarget\s*=/i.test(attrs)) return tag;            // already decided
    return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
  });
}

export const normalize = html => outboundNewTab(linkifyEmail(html));

// CLI: only when executed directly, never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node bin/normalize-issue.mjs <issue.html>');
    process.exit(2);
  }
  const before = readFileSync(file, 'utf8');
  const after  = normalize(before);
  const count = s => ({
    mailto: (s.match(/href="mailto:/g) || []).length,
    newtab: (s.match(/target="_blank"/g) || []).length,
  });
  const a = count(before), b = count(after);
  if (after !== before) writeFileSync(file, after);
  console.log(`normalize ${file}`);
  console.log(`  mailto links: ${a.mailto} -> ${b.mailto}`);
  console.log(`  new-tab links: ${a.newtab} -> ${b.newtab}`);
  if (EMAIL && b.mailto === 0) {
    console.log(`  ::warning::no ${EMAIL} anchor in this issue — readers cannot write in`);
  }
  if (!EMAIL) {
    console.log('  note: no contactEmail in site.config.json — email linkification skipped');
  }
}
