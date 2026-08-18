// TEMPLATE — ArcGIS FeatureServer/MapServer adapter. NOT REGISTERED.
//
// Copy to a real name (e.g. crime.mjs), fill in every <PLACEHOLDER>, then register
// it in bin/adapters/index.mjs. Read bin/adapters/README.md first — every rule in
// it is enforced or assumed by the rest of the pipeline.
//
// FINDING YOUR CITY'S PORTAL
// Many US cities and counties publish crime, 311, permits, and parcel layers on
// ArcGIS. Look for URLs like:
//   https://<host>/arcgis/rest/services/...  or  .../rest/services/.../MapServer/<layer>
// Search "<your city> open data", "<your city> GIS rest services", or use the
// /find-sources skill, which researches this for you and records what it finds.
// Append `?f=json` to a layer URL to see its fields; append
// `/query?f=json&where=1=1&returnCountOnly=true` to test that it answers.
//
// THE TRAPS THIS TEMPLATE ALREADY HANDLES (learned the hard way upstream)
//   - Long where-clauses 403 at random on some services → one retry, then record.
//   - encodeURIComponent leaves single quotes raw; some servers reject them → %27.
//   - Date-literal dialects differ per service (DATE '...' vs timestamp '...' vs
//     epoch ms) and DOCUMENTATION CANNOT TELL YOU which — only a live query can.
//     probe() tries all three and reports which worked.
//   - A numeric field filtered with quotes ("ZIPCODE='00000'") can 400 while the
//     unquoted form works — check both if your first query errors.

/* eslint-disable no-unused-vars */

// ----------------------------------------------------------------- fill these in
const SERVICE = 'https://<HOST>/arcgis/rest/services/<PATH>/MapServer'; // no trailing layer
const LAYER = 0;                            // the layer id that holds your data
const DATE_FIELD = '<REPORT_DATE_FIELD>';   // e.g. REPORT_DAT, OCCURRED_ON_DATE
const GEO_WHERE = "<GEO_FIELD>='<VALUE>'";  // e.g. "ZIP='00000'" or "DISTRICT IN ('1','2')"
// If your geography filter is NOT the ZIP itself (police districts rarely align
// with postal ZIPs), you MUST also set geographyNote in site.config.json so the
// issue explains the mismatch to readers. Never bridge the gap with a coordinate
// join — sub-ZIP geography is forbidden (see config/privacy.json).

// Categories: exact values of the category field, verified against a live query.
const CATEGORY_FIELD = '<CATEGORY_FIELD>';  // e.g. OFFENSE
const CATEGORIES = {
  // exampleKey: 'EXACT VALUE IN THE FIELD',
};

// Fields that must NEVER be fetched. If the service exposes addresses, owner
// names, or coordinates, list them here — the startup check below aborts the
// module if they ever end up in an outFields request. Omission beats scrubbing.
const FORBIDDEN = ['OWNERNAME', 'PREMISE_ADDRESS', 'LATITUDE', 'LONGITUDE', 'X', 'Y'];

// ------------------------------------------------------------------- plumbing
const enc = w => encodeURIComponent(w).replace(/'/g, '%27');

async function arcgisJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  // ArcGIS reports errors inside a 200 body. Status codes are not the truth here.
  if (j.error) throw new Error(`ArcGIS: ${j.error.message || JSON.stringify(j.error)}`);
  return j;
}

// Count with one retry: long where-clauses 403 at random on some services.
async function count(where, label, ctx) {
  const url = `${SERVICE}/${LAYER}/query?f=json&where=${enc(where)}&returnCountOnly=true`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const j = await arcgisJson(url);
      if (typeof j.count !== 'number') throw new Error('no count field in response');
      return j.count;
    } catch (e) {
      if (attempt === 2) {
        ctx.addError('<ADAPTER NAME>', url, `${label}: ${e.message}`);
        return null;   // null = not retrieved. Never substitute a guess or a zero.
      }
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

const layerFields = async () => (await arcgisJson(`${SERVICE}/${LAYER}?f=json`)).fields.map(f => f.name);

// Same month/day, prior year — the like-for-like comparison bound.
const sameDayLastYear = week => `${Number(week.slice(0, 4)) - 1}${week.slice(4)}`;

// ------------------------------------------------------------------ the adapter
export default {
  name: '<ADAPTER NAME>',        // becomes the facts-file block name, e.g. 'crime'
  critical: true,

  async fetch(ctx) {
    const { week } = ctx;
    const lastYear = sameDayLastYear(week);
    const out = { geography: GEO_WHERE, asOf: week, priorPeriodEnd: lastYear };

    // Year-to-date total, and the prior-year same-period figure that makes it a
    // comparison instead of a bare number. Adjust the where-clauses to how your
    // layer models time (some portals split years across layers; some don't).
    out.total = await count(GEO_WHERE, 'total, current period', ctx);
    out.totalPriorYear = await count(
      `${GEO_WHERE} AND ${DATE_FIELD} < DATE '${lastYear}'`,
      'total, prior year same period', ctx);

    out.categories = {};
    for (const [key, value] of Object.entries(CATEGORIES)) {
      out.categories[key] = {
        now: await count(`${GEO_WHERE} AND ${CATEGORY_FIELD}='${value}'`, `${key}, current`, ctx),
        priorYear: await count(
          `${GEO_WHERE} AND ${CATEGORY_FIELD}='${value}' AND ${DATE_FIELD} < DATE '${lastYear}'`,
          `${key}, prior year`, ctx),
      };
    }

    // Derive here, don't editorialize in prose: deltas, and small-base rules the
    // writing model must obey, embedded in the data itself.
    for (const [key, v] of Object.entries(out.categories)) {
      if (v.now == null || v.priorYear == null) continue;
      v.changeAbs = v.now - v.priorYear;
      v.changePct = v.priorYear === 0 ? null : Math.round(((v.now - v.priorYear) / v.priorYear) * 100);
      if (v.priorYear < 20 && v.changePct != null) {
        ctx.addRule(`${this.name}.${key}: prior-year base is ${v.priorYear} — report the absolute change ` +
          `(${v.changeAbs >= 0 ? '+' : ''}${v.changeAbs}); treat ${v.changePct}% as indicative only.`);
      }
    }

    ctx.addRule(`${this.name} figures are reported records, not incidence — ` +
      `write "reported", and cite the query date ${week}.`);
    return out;
  },

  // Liveness + meaning, run weekly by bin/probe-sources.mjs. A dead endpoint
  // should be discovered on Monday, not inside Friday's unattended publish run.
  async probe() {
    return [
      {
        name: `${SERVICE.split('/').slice(-2).join('/')}: fields present`,
        critical: true,
        run: async () => {
          const f = await layerFields();
          for (const need of [DATE_FIELD, CATEGORY_FIELD]) {
            if (!f.includes(need)) throw new Error(`field ${need} is gone — the adapter is dead`);
          }
          const leaked = FORBIDDEN.filter(x => f.includes(x));
          return `${DATE_FIELD}, ${CATEGORY_FIELD} present` +
            (leaked.length ? `; service still exposes ${leaked.join(', ')} — keep them out of every query` : '');
        },
      },
      {
        name: 'geography filter returns a plausible count',
        critical: true,
        run: async () => {
          const j = await arcgisJson(`${SERVICE}/${LAYER}/query?f=json&where=${enc(GEO_WHERE)}&returnCountOnly=true`);
          // Set the floor from a real first run. A 200 with zero rows would become
          // "nothing happened" in print — a lie rather than a gap.
          if (!j.count || j.count < 1) throw new Error('zero rows for the standing geography — implausible, treat as broken');
          return `${j.count} rows for ${GEO_WHERE}`;
        },
      },
      {
        name: 'which date-literal dialect this service accepts',
        critical: false,
        run: async () => {
          const from = '<RECENT YYYY-MM-DD>'; // ~90 days back; update when enabling
          const dialects = [
            ['DATE', `${DATE_FIELD} >= DATE '${from}'`],
            ['timestamp', `${DATE_FIELD} >= timestamp '${from} 00:00:00'`],
          ];
          const ok = [];
          for (const [name, where] of dialects) {
            try {
              const j = await arcgisJson(`${SERVICE}/${LAYER}/query?f=json&where=${enc(`${GEO_WHERE} AND ${where}`)}&returnCountOnly=true`);
              if (j.count > 0) ok.push(`${name}=${j.count}`);
            } catch { /* rejected dialect is the thing being measured */ }
          }
          if (!ok.length) throw new Error('no date-literal dialect returned rows');
          return `accepted: ${ok.join(', ')}`;
        },
      },
    ];
  },

  // Re-query printed windows and measure how much published figures moved.
  // The only check in the kit that does not depend on the writing model's judgment.
  async retrospective({ editions }) {
    const rows = [], errors = [];
    for (const { week, facts } of editions) {
      const then = facts?.[this.name];
      if (!then || then.total == null) continue;
      const bound = `${DATE_FIELD} < DATE '${week}'`;   // reconstruct the window as it stood
      const ctx = { addError: (s, url, m) => errors.push({ source: s, url, message: m }) };
      const now = await count(`${GEO_WHERE} AND ${bound}`, `retro ${week} total`, ctx);
      if (now != null) rows.push({ week, key: `${this.name}.total`, printed: then.total, now, delta: now - then.total });
    }
    return { rows, errors };
  },
};
