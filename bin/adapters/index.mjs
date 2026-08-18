// The adapter registry — auto-discovered, so the kit owns this file and YOUR
// adapters own theirs, and a kit update can never wipe your wiring.
//
// Any .mjs file in this directory that does not start with "_" (and isn't this
// file) is loaded as an adapter. That rule exists because of a real incident:
// when adapters had to be hand-registered here, a template update following the
// "kit files take the update" merge rule replaced an instance's registry with
// the empty default — four working adapters silently unhooked, every gate still
// green, and the next issue would have had no local data at all. Instance state
// must never live in a kit-owned file. (First found by the 90744 field test.)
//
// The kit ships with ZERO adapters. That is deliberate: every ZIP code has
// different open-data portals, different field names, and different quirks, and
// a default that silently queried the wrong city would be worse than no default.
// Your first working adapter is the "prove one end to end" step — get one source
// fetching, verified, and plausible before you add a second.
//
// HOW TO ENABLE AN ADAPTER
//   1. Copy a template (_template-arcgis.mjs for ArcGIS FeatureServer portals,
//      _template-socrata.mjs for Socrata) to a real name, e.g. crime.mjs. The
//      /find-sources skill helps you locate your portal and fill in endpoints.
//   2. Follow the checklist in bin/adapters/README.md — especially the
//      null-vs-error contract and the assert-meaning rules.
//   3. That's it — the file registers itself by existing. No list to edit.
//      (Helper modules that are NOT adapters must start with "_".)
//   4. Run `node bin/probe-sources.mjs` until it passes, then
//      `node bin/fetch-data.mjs --week YYYY-MM-DD` and READ the facts file.
//
// ADAPTER INTERFACE — each adapter file must export the object as `adapter`
// (`export const adapter = {...}`) or as its default export:
//   {
//     name: 'crime',          // becomes the block name in data/facts/<week>.json
//     critical: true,         // if ALL critical adapters fail, the weekly run fails
//     daily: false,           // OPTIONAL: true = the daily digest re-fetches this and
//                             // reports changed values (see docs/DAILY-DIGEST.md).
//                             // Most weekly series don't move daily — leave it off
//                             // unless the source genuinely updates day to day.
//     async fetch(ctx) {},    // returns the block object; nulls where retrieval failed
//     async probe() {},       // OPTIONAL: returns [{ name, critical, run }] liveness checks
//     async retrospective(ctx) {},  // OPTIONAL: re-query printed windows, return drift rows
//   }
//
//   ctx for fetch(): { config, week, windowStart, windowEnd, addError, addRule, addNote }
//     config       parsed site.config.json
//     week         'YYYY-MM-DD' issue date
//     windowStart  'YYYY-MM-DD' seven days before week
//     windowEnd    same as week
//     addError(source, url, message)  record a failed retrieval (the value stays null)
//     addRule(text)   append an instruction for the writing model to facts.agentRules[]
//     addNote(text)   append an operational note to facts.notes[]

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter(f => f.endsWith('.mjs') && !f.startsWith('_') && f !== 'index.mjs')
  .sort();

export const adapters = [];
for (const f of files) {
  const mod = await import(pathToFileURL(join(dir, f)).href);
  const a = mod.adapter ?? mod.default;
  if (!a || typeof a !== 'object' || typeof a.fetch !== 'function' || !a.name) {
    // Fatal, not skipped: a silently-ignored broken adapter looks exactly like
    // a quiet data source, and that is the failure mode this kit exists to kill.
    console.error(`[adapters] bin/adapters/${f} does not export a valid adapter.`);
    console.error('[adapters] An adapter file must `export const adapter = { name, critical, fetch, ... }`');
    console.error('[adapters] (or export it as default). Helper modules that are not adapters');
    console.error('[adapters] must have a filename starting with "_" so discovery skips them.');
    process.exit(2);
  }
  adapters.push(a);
}
