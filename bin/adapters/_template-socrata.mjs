// TEMPLATE — Socrata open-data adapter. NOT REGISTERED.
//
// Copy to a real name (e.g. service-requests.mjs), fill in every <PLACEHOLDER>,
// then register it in bin/adapters/index.mjs. Read bin/adapters/README.md first.
//
// FINDING YOUR CITY'S PORTAL
// Hundreds of US cities/counties/states run Socrata portals — the giveaway is a
// site like data.<city>.gov or <city>.data.socrata.com where every dataset has a
// nine-character id like "abcd-1234". The API endpoint is then:
//   https://<host>/resource/<dataset-id>.json
// Search "<your city> data portal 311", or use the /find-sources skill. Open the
// dataset page → "API" button to see the endpoint and field names — then verify
// them with a live query, because DOCUMENTED IS NOT THE SAME AS WORKING.
//
// SOCRATA NOTES
//   - Query language is SoQL, passed as URL params: $select, $where, $group, $limit.
//   - Counts: $select=count(*) — returns [{ count: "123" }] (a STRING; Number() it).
//   - Dates are ISO floating timestamps: my_date > '2026-01-01T00:00:00.000'.
//   - Unauthenticated requests are throttled per IP. Fine for a weekly fetch; if
//     you hit 429s, register a free app token and send X-App-Token.

/* eslint-disable no-unused-vars */

// ----------------------------------------------------------------- fill these in
const ENDPOINT = 'https://<HOST>/resource/<DATASET-ID>.json';
const DATE_FIELD = '<created_date_field>';
const GEO_WHERE = `<geo_field>='<VALUE>'`;      // e.g. `incident_zip='00000'`
const CATEGORY_FIELD = '<category_field>';       // e.g. complaint_type
const CATEGORIES = {
  // exampleKey: 'Exact Value In The Field',
};
// Never $select fields that must not be published (addresses, names, coordinates).
const FORBIDDEN = ['latitude', 'longitude', 'incident_address', 'owner_name'];

// ------------------------------------------------------------------- plumbing
async function soql(params, label, ctx) {
  const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 2) {
        if (ctx) ctx.addError('<ADAPTER NAME>', url, `${label}: ${e.message}`);
        return null;
      }
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

async function countWhere(where, label, ctx) {
  const rows = await soql({ $select: 'count(*)', $where: where }, label, ctx);
  if (rows === null) return null;                       // failed → already recorded
  const n = Number(rows?.[0]?.count);
  if (!Number.isFinite(n)) {
    if (ctx) ctx.addError('<ADAPTER NAME>', ENDPOINT, `${label}: no count in response`);
    return null;
  }
  return n;   // 0 is a real answer here — "queried and empty" is a verified result
}

const soqlDate = ymd => `${ymd}T00:00:00.000`;
const minusDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  return new Date(d.getTime() - n * 86400000).toISOString().slice(0, 10);
};

// ------------------------------------------------------------------ the adapter
export default {
  name: '<ADAPTER NAME>',       // becomes the facts-file block name, e.g. 'sr311'
  critical: true,

  async fetch(ctx) {
    const { week, windowStart } = ctx;
    const out = { geography: GEO_WHERE, windowDays: 7, weekStart: windowStart, asOf: week };

    // The week's count, and the trailing-90-day baseline that makes it a finding.
    out.total = await countWhere(
      `${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate(windowStart)}'`, 'weekly total', ctx);
    out.baseline90dTotal = await countWhere(
      `${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate(minusDays(week, 90))}'`, '90-day baseline', ctx);

    out.categories = {};
    for (const [key, value] of Object.entries(CATEGORIES)) {
      out.categories[key] = {
        week: await countWhere(
          `${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate(windowStart)}' AND ${CATEGORY_FIELD}='${value}'`,
          `${key} this week`, ctx),
        base90: await countWhere(
          `${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate(minusDays(week, 90))}' AND ${CATEGORY_FIELD}='${value}'`,
          `${key} 90-day`, ctx),
      };
    }

    // Volume verdict computed here, not in prose.
    if (out.total != null && out.baseline90dTotal != null) {
      const perDay = out.total / 7, basePerDay = out.baseline90dTotal / 90;
      out.volume = {
        perDay: Number(perDay.toFixed(1)),
        baselinePerDay: Number(basePerDay.toFixed(1)),
        verdict: perDay > basePerDay * 1.25 ? 'elevated' : perDay < basePerDay * 0.75 ? 'quiet' : 'normal',
      };
    }

    // What this dataset measures — a rule for the writer, carried with the data.
    ctx.addRule(`${this.name} measures who reports, not conditions — never compare this ` +
      `geography's volume to another's, and say "requests", not "problems".`);
    return out;
  },

  async probe() {
    return [
      {
        name: `${ENDPOINT.split('/').pop()}: answers for the standing geography`,
        critical: true,
        run: async () => {
          const n = await countWhere(GEO_WHERE, 'probe', null);
          if (n === null) throw new Error('query failed');
          // Floor from a real first run: a working 311 dataset for an inhabited
          // ZIP is never zero over its whole history.
          if (n < 1) throw new Error('zero rows for the standing geography — filter or field name is wrong');
          return `${n} rows for ${GEO_WHERE}`;
        },
      },
      {
        name: 'date field filters correctly',
        critical: true,
        run: async () => {
          const recent = await countWhere(`${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate('<RECENT YYYY-MM-DD>')}'`, 'probe date', null);
          if (recent === null) throw new Error(`${DATE_FIELD} filter failed — renamed field or changed type`);
          return `${recent} rows in the recent window`;
        },
      },
    ];
  },

  async retrospective({ editions }) {
    const rows = [], errors = [];
    for (const { week, facts } of editions) {
      const then = facts?.[this.name];
      if (!then || then.total == null || !then.weekStart) continue;
      const ctx = { addError: (s, url, m) => errors.push({ source: s, url, message: m }) };
      const now = await countWhere(
        `${GEO_WHERE} AND ${DATE_FIELD} > '${soqlDate(then.weekStart)}' AND ${DATE_FIELD} <= '${soqlDate(week)}'`,
        `retro ${week}`, ctx);
      if (now != null) rows.push({ week, key: `${this.name}.total`, printed: then.total, now, delta: now - then.total });
    }
    return { rows, errors };
  },
};
