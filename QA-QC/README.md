# QA-QC — how quality is checked, and by whom

Four layers, deliberately separate. There is **no weighted composite score**:
averaging is exactly the wrong operation when some failures are disqualifying, so
each layer answers its own question and none of them trades against another.

| Layer | Where | Answers | Cannot answer |
|---|---|---|---|
| **Gates** | `bin/privacy-scan.mjs`, `bin/verify-issue.mjs` | Did the issue keep its non-negotiable promises? Binary; blocks publication. | Whether claims are true or useful |
| **Craft rubric** | `QA-QC/RUBRIC.md` (the Seven Questions) | Is this issue well made? Graded judgement, informed by counts. | Whether claims are true |
| **Accuracy log** | `data/accuracy-log.md` | Are the claims true? Three claims per issue, checked after publication. | Whether anyone wants them |
| **Readers** | your feedback inbox | Is it useful? | — |

Two more checks run on separate axes:

- `bin/source-retrospective.mjs` re-queries figures already published and diffs them
  against what was printed — the only check not made by the model that wrote the
  issue.
- `bin/check-published.mjs` asks whether the week that should exist, exists at all.
  Liveness is counted separately from quality: a newsletter that is excellent three
  weeks in four is not yet a weekly newsletter.

## Running the measurement

```
node QA-QC/measure-issue.mjs issues/<YYYY-MM-DD>.html
```

Run from the repo root. It prints evidence counts (citations, source classes,
hedges, superlatives, paired percentages, disclosure elements) and archives a copy
to `QA-QC/measurements/` for real issues so numbers can be trended across editions.
It does not score — assumption A7: counts inform judgement, they do not replace it.

Then apply the rubric using the twenty-minute procedure at the bottom of
`RUBRIC.md`, and log three verified claims in `data/accuracy-log.md`.

**Never with the model that wrote the issue.** Score with a different model, or a
person, or both. Self-assessment measures confidence, not quality.

## The writer may read this directory. It may never write to it.

The editorial brief tells the writing model it may read `QA-QC/` — the standard
should be visible to the thing being judged. It also forbids writing here, because
a model that can edit its own rubric can soften a band instead of meeting it, and
the whole apparatus becomes decorative.

That rule is enforced by the weekly workflow, not by trust: after the issue is
written, CI runs `git status --porcelain QA-QC` and **fails the entire run if
anything in this directory changed**. The judged must not be able to edit its own
judge.

## When a validator passes on bad input

Test every new gate against a real failing case before trusting it —
`bin/doctor.mjs` runs all gates against `fixtures/` (one known-good issue, several
known-bad ones) and fails if any gate mis-fires in either direction. When a
validator passes on input you know is bad, **the validator is the bug.**
