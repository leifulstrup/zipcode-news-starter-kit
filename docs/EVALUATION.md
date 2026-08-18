# Is it any good? — how that question gets answered

The publication ships with "(Experimental)" in its name because two things are
genuinely unknown at launch: whether it is **useful** and whether it is **accurate**.
This document is how those get answered, so the word comes off on evidence rather
than on a feeling — or stays on honestly.

Neither question can be settled by the pipeline. Every gate checks that an issue
keeps its *promises* — disclosure, attribution, privacy, structure. None of them can
tell whether a sentence is true or whether anyone cares.

## Four layers, and what each cannot do

| Layer | Where | Answers | Cannot answer |
|---|---|---|---|
| **Gates** | `bin/privacy-scan.mjs`, `bin/verify-issue.mjs` | Did the issue keep its non-negotiable promises? Binary, blocks publication. | Whether the claims are true, well-framed, or useful |
| **Craft rubric** | `QA-QC/RUBRIC.md` | Is it traceable, honest about uncertainty, locally specific, broad in whose interests it serves, actionable, restrained, disclosed? Graded, advisory. | Whether the claims are true |
| **Accuracy log** | `data/accuracy-log.md` | Are the claims true? | Whether anyone wants them |
| **Readers** | Feedback + analytics | Is it useful? | — |

A high rubric score on a false issue is entirely possible, which is why the accuracy
log exists and why it is the layer that cannot be automated. A truthful issue can be
unreadable or impossible to act on — which is why the rubric exists. Neither
replaces the other, and neither answers the utility question.

**Why no weighted composite score.** The obvious design — score the dimensions,
weight them, publish above a threshold — is rejected on purpose. Averaging is the
wrong operation when some failures are disqualifying: strong scores on seven
dimensions can carry a fatal weakness on the eighth over the line. Gates stay
binary; judgement stays graded; the two never mix.

**The layers self-judge — except one.** The gates, the rubric, and the addendum all
run at publication time using the same model family that wrote the issue. The
source retrospective (`bin/source-retrospective.mjs`) is the exception: it re-asks
the same query of the same source weeks later and diffs the answer against what was
printed. It is the only check that gets stronger simply by waiting, and its findings
(`data/source-reliability.md`) should govern how confidently the lead figures are
phrased.

## The weekly accuracy check (~10 minutes, human, non-negotiable)

Take **three claims per issue** and verify each against its cited source. Choose
deliberately, not at random:

1. **The most consequential claim** — the one a reader might act on.
2. **The most quantitative claim** — a number, percentage, or trend.
3. **One claim from a section you did not write the rules for** — where the model
   had the most latitude.

Record each as **correct / misleading / wrong** in `data/accuracy-log.md` with a
one-line note. **Misleading is its own category and the most important one**: a
figure can be arithmetically correct and still leave a false impression — a
percentage with no denominator, a one-month move framed as a trend, a citywide
statistic in a paragraph about the neighborhood. Fluent prose fails this way far
more often than it states a plainly false number.

### What to do with the result

| Pattern | Read it as | Action |
|---|---|---|
| Wrong figures | The facts pipeline, not the writer | Move the number into an adapter so it is **fetched, not asked for** |
| Misleading framing | The brief | Add the rule to `prompts/write-issue.md`, and to `bin/verify-issue.mjs` if checkable |
| Claim with no traceable source | The most serious kind | The addendum should have caught it; extend its checks |
| Correct but stale | Source cadence | Note it in `data/sources-ranked.md` |

**Fetch it, don't ask for it — the principle, with its evidence.** The reference
publication tested the alternative repeatedly: crime figures were wrong until a
script fetched them; housing figures were misleading until a script fetched them;
and a prompt rule explicitly requiring civic docket identifiers produced *zero* of
them across three issues — the count moved only when the identifiers arrived in the
facts file. A rule that can be enforced in code should never live only in the
brief. The brief is advice to a model that may or may not follow it; the gate is
arithmetic.

### The bar for removing "(Experimental)"

**Eight consecutive issues with no wrong claim and no more than one misleading
claim per issue**, accuracy log public, plus at least one retrospective pass with
the lead figures' drift measured. Eight weeks is long enough to cross a holiday
lull — the exact condition under which a thin week tempts a publication to reach.

## Liveness is a separate axis

The layers above grade issues that exist; an unpublished week scores no worse than a
perfect one, because it is never measured. A publication's most basic promise is
that it appears, so `bin/check-published.mjs` asks a different question entirely —
*did the thing happen?* — and its record is counted separately. **A newsletter that
is excellent three weeks in four is not yet a weekly newsletter.**

## Utility — the question that cannot be measured from inside

Cloudflare's cookieless analytics can show returning readers, section reach, and PDF
downloads (someone printing an issue is the strongest available signal it is being
*used*). But the real instrument is people, and the useful questions are: What did
you already know before reading this? What did you want that wasn't here? Did you
follow any of the sources?

**The honest failure mode is not being wrong. It is being accurate and
uninteresting** — a competent summary of public datasets that no neighbor needs,
because the things they care about were never in a dataset. Watch for the tell:
*"this is fine, but I already knew all of it."* That is a **sourcing** problem, not
a writing problem, and the response is `data/sources-ranked.md` and `/add-source`,
not the brief.
