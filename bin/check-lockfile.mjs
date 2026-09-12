#!/usr/bin/env node
/**
 * package-lock.json must agree with package.json — checked before the run spends anything.
 *
 *   node bin/check-lockfile.mjs             # this checkout
 *   node bin/check-lockfile.mjs --dir path  # another one (how doctor drives it red)
 *
 * WHY THIS EXISTS — a defect that cost the reference implementation a finished edition,
 * and that this kit shipped too.
 *
 * package-lock.json is TRACKED, and `npm install` WRITES it: it syncs the name and version
 * fields to package.json as a side effect of installing. The weekly run installs Playwright
 * to render the PDF. So twelve minutes into a run — after the research, the writing and
 * every gate — a tracked file that the run never meant to touch was modified.
 *
 * The Commit step stages a few paths by name and deliberately does not `git add -A`. So the
 * commit succeeded and `git rebase origin/main` then refused to start:
 *
 *     error: cannot rebase: You have unstaged changes.
 *
 * and the edition — issue, PDF, addendum, facts, all gate-green — was discarded at the last
 * step. On 2026-09-11 that happened to 20015 News, the reference implementation. This kit
 * had the identical defect and could not have noticed: the template's own weekly run stops
 * at the placeholder-ZIP preflight, so the failing step never executes here. It would have
 * fired on the first real publication of every copy anyone made.
 *
 * The workflow now runs `npm ci`, which installs FROM the lockfile and never writes it, so
 * that mechanism is gone. This check is the other half: `npm ci` exits 0 on a drifted
 * lockfile, so it prevents the symptom without ever naming the fault. It also catches the
 * one thing `npm ci` turns into a HARD failure — a package.json dependency the lockfile has
 * never seen — and says what to type, rather than leaving a non-technical publisher with
 * npm's own error text partway through a Friday run.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const di = argv.indexOf('--dir');
const dir = di > -1 ? argv[di + 1] : '.';

const FIX = 'npm install --package-lock-only --no-audit --no-fund';

const read = (p, what) => {
  if (!existsSync(p)) {
    console.error(`${p} does not exist.\n`);
    console.error(what === 'lock'
      ? `The lockfile is how the weekly run installs exactly what this kit was tested with.\n` +
        `Create it with:\n\n  npm install --package-lock-only --no-audit --no-fund\n\n` +
        `and commit it.`
      : `This is not the root of the kit, or the checkout is incomplete.`);
    process.exit(2);
  }
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { console.error(`${p} is not valid JSON — ${e.message}`); process.exit(2); }
};

const pkg  = read(path.join(dir, 'package.json'), 'pkg');
const lock = read(path.join(dir, 'package-lock.json'), 'lock');
const root = lock.packages?.[''] ?? {};

const problems = [];

/* npm writes name and version in TWO places in a lockfileVersion 3 file. A check that read
   only the top level would go green on a file npm was still about to rewrite — which is the
   same silent pass as no check at all. */
for (const field of ['name', 'version']) {
  for (const [where, got] of [['', lock[field]], ['packages[""].', root[field]]]) {
    if (got !== pkg[field]) {
      problems.push({
        what: `package-lock.json ${where}${field}`,
        got: got ?? '(absent)',
        want: pkg[field],
        why: `\`npm install\` will rewrite this field and leave package-lock.json modified.`,
      });
    }
  }
}

/* The failure mode `npm ci` introduces. `npm install` would quietly resolve a new dependency;
   `npm ci` refuses to run at all. That is the right behaviour — but it happens inside the
   weekly run, and npm's message ("lock file's X does not satisfy Y") does not say what to
   type. Catch it here, before anything expensive, and say it. */
for (const kind of ['dependencies', 'devDependencies']) {
  for (const [name, range] of Object.entries(pkg[kind] ?? {})) {
    const locked = root[kind]?.[name];
    if (locked === undefined) {
      problems.push({
        what: `package-lock.json is missing ${kind.replace('Dep', ' dep')} "${name}"`,
        got: '(absent)', want: range,
        why: `\`npm ci\` will REFUSE to run — it installs only what the lockfile records.`,
      });
    } else if (locked !== range) {
      problems.push({
        what: `package-lock.json records a different range for "${name}"`,
        got: locked, want: range,
        why: `package.json and the lockfile disagree; \`npm ci\` may refuse to run.`,
      });
    } else if (!lock.packages?.[`node_modules/${name}`]) {
      problems.push({
        what: `package-lock.json has no resolved entry for "${name}"`,
        got: '(absent)', want: 'a node_modules/ entry with a version and integrity hash',
        why: `The range is recorded but nothing is pinned, so \`npm ci\` cannot install it.`,
      });
    }
  }
}

if (problems.length === 0) {
  console.log(`package-lock.json agrees with package.json — ${pkg.name} ${pkg.version}`);
  process.exit(0);
}

console.error(`package-lock.json does not agree with package.json.\n`);
for (const p of problems) {
  console.error(`  ${p.what}`);
  console.error(`      is:     ${p.got}`);
  console.error(`      should: ${p.want}`);
  console.error(`      ${p.why}\n`);
}
console.error(
  `WHY THIS BLOCKS A RUN. package-lock.json is tracked by git. The weekly run installs\n` +
  `Playwright to make the PDF, and a lockfile that disagrees with package.json either gets\n` +
  `rewritten mid-run — leaving a modified file that stops the final push and throws away a\n` +
  `finished issue — or stops the install outright.\n\n` +
  `FIX IT WITH ONE COMMAND, from the root of this repository:\n\n  ${FIX}\n\n` +
  `then commit package-lock.json. If you changed the version in package.json, commit both\n` +
  `together — they are meant to move as a pair.`);
process.exit(1);
