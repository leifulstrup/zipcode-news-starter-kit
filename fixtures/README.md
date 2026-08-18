# Fixtures — known-good and known-bad issues for testing the gates

These files are test scaffolding for `bin/doctor.mjs`. They are never published:
`build.mjs` reads only `issues/`, and nothing in the pipeline copies from here.
Every fact in them is fictional (ZIP 00000, "Anytown"), and each file is labeled a
sample in its own text.

Why they exist: **when a validator passes on input you know is bad, the validator
is the bug.** Every gate in this kit is tested against a real failing case before
it is trusted — that rule came from the reference implementation, where a
structural check once silently skipped the one broken item it existed to catch.

| File | What it proves |
|---|---|
| `good-issue.html` | A fully conforming bare issue. Must pass `verify-issue` and `privacy-scan` with zero FATALs. Also the working example of every required element in docs/CONTRACT.md §5. |
| `bad-no-disclosure.html` | The AI-disclosure bar and phrase are missing → verify must FAIL. |
| `bad-fabricated-figure.html` + `.facts.json` | The facts file records a failed query, and the issue asserts the figure anyway, admitting nothing → verify must FAIL ("the exact shape of a fabricated number"). |
| `bad-privacy-leak.html` | A coordinate pair, second-person home framing, and a personal email → privacy-scan must FAIL. |
| `bad-double-wrapped.html` | Site chrome saved back into a bare issue → verify must FAIL. |
| `bad-missing-sources.html` | Per-section source blocks deleted → verify must FAIL. |

The bad fixtures are derived from `good-issue.html` with one focused mutation each,
so a doctor failure points at exactly one gate. If you change a gate, add a fixture
that proves the new behavior — in both directions.

Run the whole suite: `node bin/doctor.mjs`
