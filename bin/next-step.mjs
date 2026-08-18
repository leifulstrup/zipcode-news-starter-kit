// Answers the one question every new publisher asks: "what do I do next?"
//
// It inspects the folder's actual state — no AI involved — and prints where you
// are in the journey, what is already done, and the exact sentence to paste to
// Claude for the next step. Deterministic on purpose: onboarding orientation
// must not depend on how capable the assisting model is, or on the user knowing
// which environments accept typed /commands. Run it any time you're lost:
//
//     node bin/next-step.mjs
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadConfig, loadSources } from './lib/config.mjs';

const cfg = loadConfig();
const src = loadSources();

const issues = existsSync(join(ROOT, 'issues'))
  ? readdirSync(join(ROOT, 'issues')).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
  : [];

// "Live" is detected from what /go-live actually writes into the repo (the site
// host in config), NOT from the git remote — a fresh `git clone` has a remote
// from minute one, which would mark this step done before it ever ran.
const hasGoneLive = cfg.domain !== '' || src.self.length > 0;

const configured = cfg.zip !== '00000';
const hasSources = src.primary.length + src.interestedPrimary.length + src.secondary.length > 0
  || (existsSync(join(ROOT, 'data', 'source-log.md'))
      && /\| *\d{4}-\d{2}-\d{2}/.test(readFileSync(join(ROOT, 'data', 'source-log.md'), 'utf8')));

const steps = [
  {
    done: configured,
    label: `configure the publication (/setup)`,
    skill: 'setup',
    why: 'The config still has the placeholder ZIP 00000 — nothing is yours yet.',
  },
  {
    done: hasSources,
    label: 'discover and approve your sources (/find-sources)',
    skill: 'find-sources',
    why: 'No sources are registered yet. This is the step where the newsletter starts to become yours.',
  },
  {
    done: issues.length > 0,
    label: 'write a first issue locally (/first-issue)',
    skill: 'first-issue',
    why: 'No issue exists yet. This proves the whole pipeline on your ZIP before anything goes online.',
  },
  {
    done: hasGoneLive,
    label: 'publish to the web (/go-live)',
    skill: 'go-live',
    why: 'No live site URL is configured yet, so nothing publishes automatically.',
  },
];

console.log(`\nnext-step — ${cfg.siteName}${configured ? ` (ZIP ${cfg.zip})` : ''}\n`);
for (const s of steps) console.log(`  ${s.done ? '[done]' : '[    ]'}  ${s.label}`);

const next = steps.find(s => !s.done);
if (next) {
  console.log(`\nNEXT: ${next.label}`);
  console.log(`  ${next.why}\n`);
  console.log('  Paste this to Claude (works in Claude Code, Cowork, or the desktop app):');
  console.log(`\n      Read .claude/skills/${next.skill}/SKILL.md and follow it.\n`);
  console.log(`  (In a Claude Code terminal launched from this folder, typing /${next.skill} does the same.)`);
} else {
  console.log(`\nAll four setup steps are done — you are live. The weekly rhythm now:`);
  console.log('  - Issues publish automatically; a red X in GitHub Actions means nothing');
  console.log('    published and last week\'s issue is still up (by design).');
  console.log('  - Ten minutes a week: verify three claims into data/accuracy-log.md,');
  console.log('    and check the feedback inbox (docs/FEEDBACK-INBOX.md).');
  console.log('  - Heard of a new source? Paste to Claude:');
  console.log('        Read .claude/skills/add-source/SKILL.md and follow it.');
  console.log('  - Want a private daily "what changed" email? Paste to Claude:');
  console.log('        Read .claude/skills/enable-daily/SKILL.md and follow it.');
  console.log('  - Silence from the watchdogs means the system is working.');
}
console.log('\nHealth check any time: node bin/doctor.mjs\n');
