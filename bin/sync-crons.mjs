// sync-crons — derive every workflow schedule from site.config.json.
//
//   node bin/sync-crons.mjs [--check]
//
// Why this exists, in one sentence: modular arithmetic on weekday indices is
// not a task to leave to a human (or an agent) at 4pm on a Friday.
//
// The scar: /setup used to name only weekly.yml, while the instruction to move
// the other two schedules lived as a COMMENT inside files nobody had reason to
// open. And the arithmetic bites hardest on the kit's own recommended cadence —
// a late-afternoon Pacific publish is 23:00 UTC, so the smoke test that must run
// "one hour later" belongs on the NEXT UTC DAY. Bumping only the hour digit
// yields a smoke test 23 hours BEFORE the publish it exists to verify, which
// then passes every week against last week's site and reports green forever.
// A passing watchdog is the silence this system is designed to produce, so
// nothing ever alerts. Every US Pacific publisher following the kit's own
// advice lands in that band. (Found by the 90706 field instance.)
//
// The second scar, and the reason weekly.yml now carries THREE crons. GitHub cron is UTC
// and does not follow daylight saving, so one Friday entry publishes at 16:00 local in
// summer and 15:00 in winter. The comment here used to say "shift the hour or accept the
// drift", which is a defect with an explanation attached rather than a fixed defect — and
// for a publisher who set 4pm because 4pm is when people read it, an hour is the whole
// point. So both UTC hours that map to the publisher's local hour are emitted, and the
// preflight job in weekly.yml keeps whichever one is correct today. In a zone without
// daylight saving the two collapse to one and the duplicate simply never matches.
//
// The third is the one nothing can see from inside: GitHub silently DROPS scheduled runs
// during platform degradation and never retries them. So weekly.yml also gets a backstop
// several hours later, which declines in seconds unless the week is genuinely unpublished.
//
// Derived schedules, all from `cronUtc` (the weekly publish):
//   weekly.yml            both DST variants of cronUtc, plus a backstop 6h after
//   smoke.yml             publish + 1h (rolls the weekday), plus a daily 13:00 sweep
//   publication-check.yml publish day + 1 and + 2, at 14:00 UTC
//   daily.yml             daily.hourUtc (independent; only checked, not derived)
//   sources.yml           fixed weekly/monthly cadence; not derived
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadConfig, loadDaily } from './lib/config.mjs';

const cfg = loadConfig();
const daily = loadDaily(cfg);
const checkOnly = process.argv.includes('--check');

const m = String(cfg.cronUtc).trim().match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+([0-6])$/);
if (!m) {
  console.error(`sync-crons: site.config.json cronUtc must look like "M H * * D" (D = 0-6, Sunday=0).`);
  console.error(`sync-crons: got "${cfg.cronUtc}". /setup writes this from your publish day and timezone.`);
  process.exit(2);
}
const [, minute, hour, dow] = m;
const H = Number(hour), D = Number(dow);

// +1 hour, rolling the weekday when it crosses midnight UTC. This is the whole
// point of the script.
const smokeH = (H + 1) % 24;
const smokeD = (H + 1) >= 24 ? (D + 1) % 7 : D;

/* ---------------------------------------------------------------- daylight saving
   How many hours ahead of UTC is `tz` on `date`? Asked of the runtime rather than
   tabulated, because a table of DST rules in a starter kit is a table that goes wrong in
   a country nobody tested. */
function offsetHours(tz, date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
                           +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asIfUtc - date.getTime()) / 3600000);
}

/* The local hour the publisher actually means. `publishLocalHour` in site.config.json if
   they have said so; otherwise whatever cronUtc means TODAY in their timezone — which is
   what they are getting right now, and pinning it is the fix. */
const TZ = cfg.timezone || 'UTC';
const now = new Date();
const yr = now.getUTCFullYear();
const offJan = offsetHours(TZ, new Date(Date.UTC(yr, 0, 15, 12)));
const offJul = offsetHours(TZ, new Date(Date.UTC(yr, 6, 15, 12)));
/* Derived ONCE and then written down, which is the whole point. Deriving it fresh on every
   run would read the offset that is in force today — so in November it would decide the
   publication goes out at 15:00, and the guard meant to stop the hour drifting would drift
   with it. Pinning it here is what makes the local hour survive the clocks changing.
   (--check never writes: a checker that edits the thing it is checking is not a checker.) */
let localHour;
if (cfg.publishLocalHour !== undefined) {
  localHour = Number(cfg.publishLocalHour);
} else {
  localHour = (H + offsetHours(TZ, now) + 24) % 24;
  if (!checkOnly) {
    const cfgPath = join(ROOT, 'site.config.json');
    const raw = JSON.parse(readFileSync(cfgPath, 'utf8'));
    raw.publishLocalHour = localHour;
    writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n');
    console.log(`wrote publishLocalHour=${localHour} to site.config.json — pinned, so the ` +
      `publication hour no longer moves when the clocks do.`);
  } else {
    console.error(`::warning::site.config.json has no "publishLocalHour". Derived ${localHour} from ` +
      `cronUtc for now; run \`node bin/sync-crons.mjs\` to pin it, or the hour will drift with ` +
      `daylight saving exactly as before.`);
  }
}

/* The UTC hour+weekday that lands on `localHour` under a given offset. Subtracting an
   offset can push the time into the previous or next UTC day, which is the same weekday
   rollover this script already exists to get right. */
const utcSlot = off => {
  const raw = localHour - off;
  const h = ((raw % 24) + 24) % 24;
  const dayShift = Math.floor(raw / 24);
  return { h, d: (((D + dayShift) % 7) + 7) % 7 };
};
const slotA = utcSlot(offJan);
const slotB = utcSlot(offJul);
const sameSlot = slotA.h === slotB.h && slotA.d === slotB.d;
/* Ordered, so the generated file is stable run to run rather than flipping with the season. */
const slots = sameSlot ? [slotA]
  : [slotA, slotB].sort((x, y) => (x.d - y.d) || (x.h - y.h));

/* Backstop: six hours after the LATER of the two, so it cannot land before the publish it
   is backing up. */
const last = slots[slots.length - 1];
const backstopRaw = last.h + 6;
const backstop = { h: backstopRaw % 24, d: backstopRaw >= 24 ? (last.d + 1) % 7 : last.d };

const expected = {
  'weekly.yml': [
    ...slots.map(s => `${minute} ${s.h} * * ${s.d}`),
    ...(sameSlot ? [] : []),
    `0 ${backstop.h} * * ${backstop.d}`,
  ],
  'smoke.yml': [`${minute} ${smokeH} * * ${smokeD}`, '0 13 * * *'],
  'publication-check.yml': [`0 14 * * ${(D + 1) % 7}`, `0 14 * * ${(D + 2) % 7}`],
  'daily.yml': [`0 ${daily.hourUtc} * * *`],
};

let changed = 0, mismatched = 0;
for (const [file, crons] of Object.entries(expected)) {
  const path = join(ROOT, '.github', 'workflows', file);
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { continue; }   // daily.yml may be absent

  // Replace the Nth cron line in schedule order, preserving each line's comment.
  let i = 0;
  const updated = text.replace(/^(\s*- cron: ')([^']*)(')/gm, (whole, pre, current, post) => {
    const want = crons[i++];
    if (want === undefined || current === want) return whole;
    changed++;
    return `${pre}${want}${post}`;
  });

  const present = (text.match(/^\s*- cron: '/gm) || []).length;
  if (present !== crons.length) {
    mismatched++;
    console.error(`::error::${file} has ${present} cron line(s) but ${crons.length} are derived from ` +
      `site.config.json. This script rewrites schedules in place; it does not add or remove them. ` +
      `Add or delete cron lines in ${file} so there are ${crons.length}, then run this again.`);
    continue;
  }

  if (updated !== text) {
    mismatched++;
    if (checkOnly) {
      console.error(`::error::${file} schedule does not match site.config.json. Run: node bin/sync-crons.mjs`);
    } else {
      writeFileSync(path, updated);
      console.log(`updated ${file} -> ${crons.filter(Boolean).join(' | ')}`);
    }
  } else {
    console.log(`${checkOnly ? 'ok' : 'unchanged'} ${file} (${crons.join(' | ')})`);
  }
}

const publishUtc = `${String(H).padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
const smokeUtc = `${String(smokeH).padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
console.log(`\npublish ${publishUtc} day ${D} · smoke ${smokeUtc} day ${smokeD}` +
  (smokeD !== D ? '  <- smoke crosses into the next UTC day, as it must' : ''));
console.log(`publish local hour: ${String(localHour).padStart(2, '0')}:${minute.padStart(2, '0')} ${TZ}` +
  (cfg.publishLocalHour === undefined ? '  (derived from cronUtc; set "publishLocalHour" in site.config.json to pin it)' : ''));
if (sameSlot) {
  console.log(`${TZ} does not change its clocks, so one weekly cron is enough.`);
} else {
  console.log(`weekly.yml fires at ${slots.map(s => `${String(s.h).padStart(2, '0')}:${minute.padStart(2, '0')} UTC day ${s.d}`).join(' and ')} — ` +
    `the preflight keeps whichever is ${String(localHour).padStart(2, '0')}:00 in ${TZ} that week, so the local publish hour no longer moves with daylight saving.`);
}
console.log(`backstop ${String(backstop.h).padStart(2, '0')}:00 UTC day ${backstop.d} — declines unless the week is still unpublished.`);

if (checkOnly && mismatched) process.exit(1);
if (!checkOnly && !changed) console.log('all schedules already agree with site.config.json');
