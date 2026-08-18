# Accuracy log

The layer that answers the question the gates and the rubric cannot: **are the
claims true?** The gates check promises; the rubric checks craft; this log checks
the world. It is also the only layer that needs a human to matter — about ten
minutes per issue — and it is the sole path by which "(Experimental)" ever comes
off the masthead.

## Method

After each issue publishes, pick **three claims** — deliberately, not randomly:

1. **The most consequential claim** — the one a reader is most likely to act on.
2. **The most quantitative claim** — the number doing the most work.
3. **One claim from a section whose rules you didn't write** — the place a blind
   spot hides.

Follow each claim to its cited source and give a verdict:

- **correct** — the source says what the issue says.
- **misleading** — technically supported, but a reader would come away believing
  something the source does not establish. **Misleading is its own category and
  the most important one**: fluent prose is the default failure mode of an AI
  writer, so misleading matters more than wrong.
- **wrong** — the source contradicts the claim. Where the issue and the cited
  source disagree, the source governs and the issue is wrong.

## Remediation routing

A verdict is not the end of the entry — route the fix to where it belongs:

| Finding | Fix belongs in |
|---|---|
| Wrong figure | Move the figure into an adapter (`bin/adapters/`) so it is fetched, not researched |
| Misleading framing | The brief (`prompts/write-issue.md`) — plus a verify-issue warning if the pattern is checkable |
| Untraceable claim | Extend the addendum questions so it gets flagged before publication |
| Correct but stale | The source's cadence in `data/sources-ranked.md` |

## The "(Experimental)" bar

The masthead label becomes eligible to come off after **eight consecutive
PUBLISHED issues with no wrong claim and at most one misleading claim per
issue**, with this log public. Not before, and never by preference — usefulness
and accuracy are open empirical questions until the record answers them.

Pre-publication calibration issues count toward nothing here. Log their checks
(they are good practice and good history — mark them "pre-publication"), but
the eight-issue counter starts at the first issue readers could actually reach.
A concrete case from the field: an instance with a **6 correct / 0 misleading /
0 wrong** record was **zero-eighths** of the way to the bar, because all six
checks were pre-publication. Record that distinction in your own log so a later
reader does not mistake a clean calibration record for progress toward the
label.
The label is a promise about the published record; a record nobody could read
proves nothing to the people the promise is made to. An instance that writes
many local calibration issues must not arrive at the bar without ever having
published.

Meeting the bar does not remove the label by itself. When the record qualifies,
whoever notices (you, or an agent reviewing this log) **proposes** the change with
the evidence — the eight issues and their verdicts — and `site.config.json →
experimental` is set to `false` only on the publisher's explicit say-so. The label
is a public promise about the record; changing it is the publisher's call alone,
never an automated side effect.

## Running count

| correct | misleading | wrong | issues logged |
|---|---|---|---|
| 0 | 0 | 0 | 0 |

## Entries

<!-- Newest first. Template:

### Issue YYYY-MM-DD — logged YYYY-MM-DD

1. **[claim, quoted or tightly paraphrased]**
   Source: [cited URL] · Verdict: correct | misleading | wrong
   Notes: [what the source actually says; if not correct, route the fix per the table above]
2. …
3. …
-->

*No entries yet. The first issue has not been published — or has, and its ten
minutes are owed.*
