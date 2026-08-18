// _reference-lag-aware.mjs — a REFERENCE, not a runnable adapter (the leading
// underscore keeps it out of auto-discovery). Contributed by the first field
// instance (ZIP 90744, Wilmington CA), sanitized to placeholders. It exists
// because these mechanics were each learned from a published-or-nearly-published
// mistake, and the templates alone don't teach them. Read this after
// README.md §9–10; copy the patterns into your real adapters.
//
// The five patterns, in the order they earned their keep:
//   1. dataThrough / lagDays / measuredWindow — the lag-zero contract
//   2. The lag-artefact zero — the branch that prevents a fabricated "none"
//   3. The withheld verdict — a fix that needed two attempts
//   4. Geography by boundary test, never by name
//   5. Probes that assert MEANING — including the semantic-assumption probe
//
// Placeholders you would fill in a real adapter: ENDPOINT, DATE_FIELD,
// GEO_WHERE, NAME, and the soql()/countWhere() helpers from the Socrata or
// ArcGIS template.

/* eslint-disable no-undef -- illustrative fragments, not a module that runs */

// ---------------------------------------------------------------------------
// 1. THE LAG-ZERO CONTRACT — ask the feed how current it is, and measure the
//    last COMPLETE window it covers, never the nominal week.
//    (Why: a permits feed running ~7 days behind returns a true 0 for "this
//    week" every week; a crime feed with a multi-week lag ALWAYS does.)
// ---------------------------------------------------------------------------
const soqlDate = ymd => `${ymd}T00:00:00.000`;
const minusDays = (ymd, n) =>
  new Date(new Date(`${ymd}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

async function fetchWithLagContract(ctx, out) {
  // Feed currency is itself a publishable fact — query it, never assume it.
  const newest = await soql({ $select: `max(${DATE_FIELD}) as newest`, $where: GEO_WHERE });
  const through = newest?.[0]?.newest?.slice(0, 10);
  if (!through) { ctx.addError(NAME, ENDPOINT, 'could not determine feed currency'); return out; }
  out.dataThrough = through;
  out.lagDays = daysBetween(through, ctx.week);

  // Measure the last complete window the data actually covers.
  const winStart = minusDays(through, 7);
  out.measuredWindow = { start: winStart, end: through, days: 7 };
  out.total = await countWhere(
    `${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate(winStart)}' AND ${DATE_FIELD} <= '${soqlDate(through)}'`);

  // Make the writer name the window. Without this the prose says "this week"
  // over a window that ended three weeks ago, and every gate stays green.
  ctx.addRule(`${NAME} runs ${out.lagDays} days behind; the measured window ends ` +
    `${out.dataThrough}. Never write "this week" — name the window.`);
  return out;
}

// ---------------------------------------------------------------------------
// 2. THE LAG-ARTEFACT ZERO — the branch that matters most. A zero that means
//    "not reported yet" and a zero that means "none happened" are OPPOSITE
//    claims in print, and only the adapter knows which it is.
// ---------------------------------------------------------------------------
function guardLagArtefactZero(ctx, out, mStart, mEnd) {
  if (out.dataThrough && out.dataThrough < ctx.week && out.total === 0) {
    ctx.addRule(`${NAME}: the nominal week shows 0 ONLY because the feed ends ` +
      `${out.dataThrough}. Do NOT write that none were issued. Report the measured ` +
      `window ${mStart} → ${mEnd} (${out.measuredTotal}) and name it.`);
  }
}

// ---------------------------------------------------------------------------
// 3. THE WITHHELD VERDICT — a fix that needed two attempts, documented so you
//    skip attempt one. Dividing a 4.5-day count by 7 was wrong; dividing by
//    elapsed days was STILL wrong: many series have strong day-of-week
//    composition (service requests collapse on weekends), so any part-week
//    spanning a weekend scores "quiet" on shape alone. (Measured: a 4-day
//    weekend-weighted window ran 40.2/day against complete weeks of 59.9,
//    65.1, 74.6, 64.4, 67.7 — the gap was the weekend, not the neighborhood.)
//    A rate comparison across windows of different day-of-week composition is
//    invalid REGARDLESS of the denominator. Fixing the arithmetic is not
//    enough; the comparison itself must be suppressed.
// ---------------------------------------------------------------------------
function volumeVerdict(out, perDay, basePerDay) {
  return {
    verdict: !out.windowComplete ? null
      : perDay > basePerDay * 1.25 ? 'elevated'
      : perDay < basePerDay * 0.75 ? 'quiet' : 'normal',
    verdictWithheld: out.windowComplete ? null
      : 'partial window: day-of-week composition makes any rate comparison invalid',
  };
}

// ---------------------------------------------------------------------------
// 4. GEOGRAPHY BY BOUNDARY TEST, NEVER BY NAME — README.md §10 case 3.
//    Text-matching the ZIP under-returns; the place name both under- and
//    over-returns; a bounding box over-returns. Point-in-polygon against the
//    Census ZCTA boundary answers the actual question.
// ---------------------------------------------------------------------------
const toLonLat = ([x, y]) => [            // Web Mercator (EPSG:102100) → WGS84
  (x / 20037508.34) * 180,
  (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90,
];

function pointInRings(lon, lat, rings) {  // ray casting
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

// Distinguish "filter broke" from "genuinely nothing" — a broken boundary test
// must produce nulls-plus-an-error, never a publishable zero:
function assertBoundaryTestAlive(ctx, out, rows, inZip) {
  if (rows.length > 0 && inZip.length === 0) {
    ctx.addError(NAME, ENDPOINT,
      `${rows.length} rows matched the bounding box but none fell inside the ZIP polygon — ` +
      `the boundary test or the coordinate fields have changed`);
    return false;   // caller returns with every value still null
  }
  return true;
}
// For sources with no coordinates at all (police data keyed by reporting
// district): run the same intersect ONCE against the district polygons, keep
// the resulting district-ID list hardcoded with a dated provenance comment,
// and re-verify it quarterly (institutions redraw boundaries).

// ---------------------------------------------------------------------------
// 5. PROBES THAT ASSERT MEANING — four shapes, escalating in usefulness.
//    Shapes 3 and 4 are the transferable ideas: convert every discovered quirk
//    and every semantic assumption into a permanent, self-documenting
//    assertion. Liveness probes cannot catch an upstream rename that quietly
//    collapses a split into one misleading total — with all gates green.
// ---------------------------------------------------------------------------
const probes = [
  { name: 'row floor', critical: true, run: async () => {
      // 1. Liveness, with a floor taken from a real first run — not a guess.
      const n = await countWhere(GEO_WHERE);
      if (n < 100) throw new Error(`only ${n} rows — filter or field name is wrong`);
      return `${n} rows`;
  }},
  { name: 'freshness', critical: true, run: async () => {
      // 2. Freshness, thresholded by what the adapter is FOR.
      const lag = daysBetween((await newestDate()), todayYmd());
      if (lag > 60) throw new Error(`newest record is ${lag} days old — feed may have been retired`);
      return `${lag} days behind`;
  }},
  { name: 'padding trap still exists', critical: false, run: async () => {
      // 3. Assert the known upstream BUG still exists. If upstream fixes it,
      //    your workaround becomes the bug — and this is what tells you.
      const padded = await countWhere(`area_name='Harbor'`);
      if (padded > 0) return `area_name='Harbor' now returns ${padded} — upstream fixed the padding`;
      return `confirmed: still returns 0 (use the district ID, never the name)`;
  }},
  { name: 'officer-initiated split still resolvable', critical: true, run: async () => {
      // 4. Assert a SEMANTIC assumption. Example: a calls-for-service feed
      //    mixes officer-initiated records (scene markers, traffic stops) with
      //    public-initiated calls — in one measured week, 46% were
      //    officer-initiated. Publishing the raw total reports police
      //    deployment while appearing to report neighborhood demand, and the
      //    number RISES when patrols increase. The adapter splits them; this
      //    probe asserts the split's premise still holds.
      const matched = (await topCallTypes()).filter(x => OFFICER_INITIATED.test(x.call_type_text.trim()));
      if (!matched.length) throw new Error(
        'no call types match the officer-initiated pattern — codes renamed; the public/officer ' +
        'split would silently collapse into one misleading total');
      return `${matched.length} officer-initiated call types recognized`;
  }},
];

// One last field caution: string conventions are PER-DATASET, never per-agency.
// The same department's portal has served one dataset with space-padded names
// and another with unpadded names, one with 4-char zero-padded district codes
// and another without. Verify each dataset's conventions independently.
