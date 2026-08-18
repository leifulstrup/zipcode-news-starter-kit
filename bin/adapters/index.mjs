// The adapter registry — the ONLY list of local data sources the pipeline knows.
//
// The kit ships with ZERO adapters enabled. That is deliberate: every ZIP code has
// different open-data portals, different field names, and different quirks, and a
// default that silently queried the wrong city would be worse than no default.
// Your first working adapter is the "prove one end to end" step — get one source
// fetching, verified, and plausible before you add a second.
//
// HOW TO ENABLE AN ADAPTER
//   1. Copy one of the templates in this directory (_template-arcgis.mjs for ArcGIS
//      FeatureServer portals, _template-socrata.mjs for Socrata portals) to a real
//      name, e.g. crime.mjs. The /find-sources skill helps you locate your city's
//      portal and fill in the endpoint and field names.
//   2. Follow the checklist in bin/adapters/README.md — especially the null-vs-error
//      contract and the assert-meaning rules.
//   3. Import it below and add it to the array.
//   4. Run `node bin/probe-sources.mjs` until it passes, then
//      `node bin/fetch-data.mjs --week YYYY-MM-DD` and READ the facts file it wrote.
//
// ADAPTER INTERFACE (what each entry must export — see README.md for details)
//   {
//     name: 'crime',          // becomes the block name in data/facts/<week>.json
//     critical: true,         // if ALL critical adapters fail, the weekly run fails
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
//
// Example, once you have written crime.mjs:
//   import crime from './crime.mjs';
//   export const adapters = [crime];

export const adapters = [];
