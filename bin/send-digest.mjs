// Sends the daily digest to the PUBLISHER — and only the publisher.
// Usage: node bin/send-digest.mjs <digest.md>
//
// The safety property lives in code, not documentation: this script can send
// exactly one message to exactly one recipient, and that recipient must equal
// site.config.json → daily.deliverTo. There is no list, no CC, no loop over
// addresses — a mailing list cannot be built out of this script by prompt or
// by accident. If neighbors want the news, they get the public site and RSS.
//
// Transport: AgentMail HTTP API (the publisher's free inbox from /setup).
// Without AGENTMAIL_API_KEY the digest is printed instead of sent — never
// silently lost.
import { readFileSync, appendFileSync } from 'node:fs';
import { loadConfig, loadDaily } from './lib/config.mjs';

const cfg = loadConfig();
const daily = loadDaily(cfg);

const digestPath = process.argv[2];
if (!digestPath) { console.error('usage: node bin/send-digest.mjs <digest.md>'); process.exit(2); }
const digest = readFileSync(digestPath, 'utf8');

/* ---------- hard guards (code, not comments) ---------- */
const to = daily.deliverTo;
if (!to || !to.includes('@')) {
  console.error('send-digest: daily.deliverTo is not a valid address — refusing to send.');
  console.error('  This digest is send-to-self only. Set YOUR OWN address via /enable-daily.');
  process.exit(1);
}
if (!/not a mailing list/i.test(digest)) {
  console.error('send-digest: digest is missing the "not a mailing list" footer — refusing to send.');
  console.error('  Run bin/verify-digest.mjs first; the pipeline always does.');
  process.exit(1);
}
const subjectLine = digest.split('\n')[0] || '';
const subject = subjectLine.replace(/^Subject:\s*/, '').trim();
if (!subject) {
  console.error('send-digest: no "Subject:" first line — run bin/verify-digest.mjs first.');
  process.exit(1);
}
const body = digest.split('\n').slice(1).join('\n').trim();

/* ---------- no key → preview, not failure ---------- */
const key = process.env.AGENTMAIL_API_KEY;
if (!key) {
  console.log('send-digest: AGENTMAIL_API_KEY is not set — printing the digest instead of sending.');
  console.log(`  (to enable email: get an API key at agentmail.to, then \`gh secret set AGENTMAIL_API_KEY\`)`);
  console.log(`\n--- would send to ${to} ---\nSubject: ${subject}\n\n${body}\n--- end ---`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Daily digest (email not configured)\n\n**To:** ${to}\n**Subject:** ${subject}\n\n${body}\n`);
  }
  process.exit(0);
}

/* ---------- send ---------- */
const inbox = cfg.contactEmail;
if (!inbox || !inbox.endsWith('@agentmail.to')) {
  console.error('send-digest: sending requires an AgentMail inbox as site.config.json → contactEmail');
  console.error(`  (currently "${inbox || ''}"). The digest sends FROM your AgentMail inbox TO you.`);
  console.error('  Set one up with /setup (docs/FEEDBACK-INBOX.md), or leave AGENTMAIL_API_KEY unset');
  console.error('  to keep the print-to-log behavior.');
  process.exit(1);
}

// Default endpoint per AgentMail's API shape at the time of writing. Vendor
// APIs move: if this 404s, check https://docs.agentmail.to and either fix the
// path here or override it without a code change via AGENTMAIL_API_URL
// (use {inbox} as a placeholder for the sending inbox address).
const template = process.env.AGENTMAIL_API_URL
  || 'https://api.agentmail.to/v0/inboxes/{inbox}/messages/send';
const url = template.replace('{inbox}', encodeURIComponent(inbox));

const res = await fetch(url, {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ to: [to], subject, text: body }),   // exactly one recipient, by construction
  signal: AbortSignal.timeout(30000),
});

if (!res.ok) {
  const detail = await res.text().catch(() => '');
  console.error(`send-digest: AgentMail returned HTTP ${res.status} for ${url}`);
  console.error(`  ${detail.slice(0, 300)}`);
  console.error('  If 404: the API path may have moved — see docs.agentmail.to and set AGENTMAIL_API_URL.');
  console.error('  If 401/403: the API key is wrong or expired — re-run `gh secret set AGENTMAIL_API_KEY`.');
  console.log(`\n--- digest (not sent) ---\nSubject: ${subject}\n\n${body}\n--- end ---`);
  process.exit(1);
}
console.log(`send-digest: sent "${subject}" from ${inbox} to ${to}`);
