#!/usr/bin/env node
/**
 * Every `run:` block in every workflow must at least be valid shell.
 *
 *   node bin/check-workflow-shell.mjs
 *
 * WHY THIS EXISTS, AND WHAT IT DOES NOT CATCH
 * A workflow step is a shell script that nothing ever runs until a Friday. `.github/` is
 * tamper-guarded, gated and reviewed — and none of that executes a line of it. In the reference implementation on 2026-09-12
 * a step shipped to main whose "File it" block died with `line 27: found: command not found`,
 * because an edit had closed a quoted string early:
 *
 *     BODY="$BODY_PREFIX"`bin/check-published.mjs` found no ...
 *            ^ the quote closes here, and everything after it becomes shell words
 *
 * Be clear about the limits, because they are not where I first assumed they were. Whether
 * that bug is a SYNTAX error or merely a wrong one depends on quote parity — on how many
 * quotes happen to follow it, and therefore on what the `${{ }}` expressions expand to. In
 * the run that failed it parsed cleanly and died at execution with `found: command not
 * found`; reintroduced here it is caught by `bash -n`. So the same defect is sometimes
 * visible to a parser and sometimes not, which is the worst property a defect can have.
 *
 * Hence both halves: `bash -n` over every block, which catches genuine syntax errors in
 * scripts nobody has run, and a narrow lint for the exact shape above, which catches it in
 * the cases where parity hides it from the parser.
 *
 * Neither is a substitute for RUNNING the step. `bash -n` cannot see `[ -z "$X" ; then` —
 * that is a valid parse and a runtime failure — and no amount of static checking reaches
 * the class of bug this file was written in response to. The durable practice is lesson
 * extract the step, stub the commands that touch the world, and run it before pushing.
 * A checker that claimed more than this would be the kind of green that publishes.
 */

import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';

const DIR = '.github/workflows';
const tmp = mkdtempSync(path.join(tmpdir(), 'wf-shell-'));
const problems = [];
let checked = 0;

/* A deliberately small YAML reader: find `run: |` (or `>`) and take the indented block that
   follows. Bringing in a YAML parser for this would add a dependency to a repo whose whole
   dependency list is Playwright, and the shape being read is fixed and simple. */
function runBlocks(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(- )?run: *([|>][-+]?)?\s*$/);
    if (m && m[3]) {
      const indent = (m[1] + (m[2] ? '  ' : '')).length;
      const body = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (l.trim() === '') { body.push(''); continue; }
        const ind = l.match(/^ */)[0].length;
        if (ind <= indent) break;
        body.push(l.slice(indent + 2));
      }
      out.push({ line: i + 1, body: body.join('\n') });
      i = j - 1;
    } else {
      const inline = lines[i].match(/^\s*(- )?run: +(\S.*)$/);
      if (inline) out.push({ line: i + 1, body: inline[2] });
    }
  }
  return out;
}

for (const file of readdirSync(DIR).filter(f => /\.ya?ml$/.test(f)).sort()) {
  const text = readFileSync(path.join(DIR, file), 'utf8');
  for (const { line, body } of runBlocks(text)) {
    // GitHub expressions are substituted before the shell ever sees them. Replace with a
    // harmless token rather than deleting, so quoting around them is preserved exactly.
    const sh = body.replace(/\$\{\{[^}]*\}\}/g, 'X');
    checked++;

    const f = path.join(tmp, 'step.sh');
    writeFileSync(f, sh);
    const r = spawnSync('bash', ['-n', f], { encoding: 'utf8' });
    if (r.status !== 0) {
      problems.push(`${file}:${line} is not valid shell — ${(r.stderr || '').trim().split('\n')[0]}`);
      continue;
    }

    /* The narrow lint. `VAR="$OTHER"` immediately followed by a backtick is almost always an
       edit that closed the string early: the author meant the backtick to be INSIDE the
       value. Valid shell, and wrong every time it has happened here. */
    const m = sh.match(/^\s*[A-Za-z_][A-Za-z0-9_]*="\$\{?[A-Za-z_][A-Za-z0-9_]*\}?"\\?`/m);
    if (m) {
      problems.push(
        `${file}:${line} has \`${m[0].trim()}\` — the quote closes right before a backtick, so ` +
        `everything after it becomes shell words rather than part of the value. This is valid ` +
        `shell and still wrong; it is how the "File it" step died on 2026-09-12. Use ` +
        `\${VAR} inside the quotes instead.`);
    }
  }
}

rmSync(tmp, { recursive: true, force: true });

if (problems.length) {
  console.error(`workflow shell: ${problems.length} problem(s) across ${checked} run blocks\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  console.error('These blocks are shell scripts that nothing executes until a scheduled run.');
  process.exit(1);
}
console.log(`workflow shell: ${checked} run blocks parse as shell (syntax only — this does not run them)`);
