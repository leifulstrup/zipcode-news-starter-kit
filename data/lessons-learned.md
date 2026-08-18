# Lessons Learned

Two parts. **Part 1 is the consolidated standing rules — read those.** Part 2 is
the dated log they are distilled from, kept because the specific failure is often
more instructive than the rule, and because a rule with no scar attached tends to
get ignored.

The rules below are **inherited**: they were learned, each at real cost, by the
reference publication this kit was extracted from ([20015.news](https://20015.news)).
They ship with the kit because there is no reason for every ZIP to pay for them
again. Your own lessons join them: each new lesson gets a dated entry in Part 2
**and**, if it is a standing rule, a distilled sentence added to Part 1.

Operational troubleshooting — reading a failed run, hosting, DNS — lives in
`docs/OPERATIONS.md`, not here.

---

## Part 1 — Standing rules

**On the data.**
Lock every series to one geography forever and record which; a switched polygon
manufactures a fake trend. In a small submarket, a one-month median move is noise,
never a trend. Real-estate series lag by months — never frame them as "this week."
Any percentage needs its denominator and its prior-year comparison in the same
sentence, or it is not evidence. A citywide figure cannot answer a neighborhood
question — and when local and citywide diverge, that divergence *is* the story.

**On sourcing.**
Corroboration is a second independent *observation*, not a second URL — two outlets
citing one press release are one source, and three citations can be one observation.
Claims sort by stakes: Tier A (deaths, crime tied to a place or person, closures,
legal outcomes) needs two independent sources with at least one primary or it does
not run; Tier B (counts, trends, prices, deadlines) needs one primary or one named
secondary with the limitation in the sentence; Tier C (openings, hours, events) is
fine on one named local outlet — and hunting a primary source that does not exist
for a coffee shop is wasted effort. When sources conflict on Tier A or B, publish
the range and name both, or publish neither. Scraped publication dates lie —
cross-check anything date-sensitive. A 403 is not "no data"; say the query failed.
Government recesses and holidays make thin weeks; let the issue be shorter rather
than padded. Reader-suggested sources are verified and human-approved before
adoption, never auto-added.

**On what each source actually measures.**
Reported crime is not crime: feeds record *reports*, reporting rates differ hugely
by offence, and agencies call their own figures preliminary — write "reported
incidents." Service-request (311) data measures who calls, and call propensity
tracks tenure, age and engagement — never compare one ZIP's volume to another's.
Housing leads with the government's recorded sales; a model-based home-value index
is direction only, never a median, always attributed by name with its query date.
A median and a mix-controlled index disagreeing in magnitude is the normal case on
a small sales base, and the disagreement is the story — a mix shift, not
revaluation; never try to reconcile the two levels, they measure different
populations. Anything from a source that revises silently must be snapshotted at
publication or it becomes uncheckable. Ask of every new dataset: what does the most
recent period look like *before it is finished*? A same-named place in the next
county or state is a different jurisdiction — different police, schools,
government; check which side of the line every such item is on.

**On verification machinery.**
Documented is not working: field names can be read from a service definition, but
only execution tells you what the query parser accepts. Assert what the answer
should *look like*, not merely that an answer arrived — a plausibility threshold is
what stands between a silently-empty result and a wrong figure published as
primary. Enumerate the failure modes that leave no artifact, not just the ones that
leave a bad output. Distinguish "it never started" from "it started and died"
before responding — they need opposite responses. Any recurring alarm needs a
legitimate-quiet path designed in, or it trains its audience to ignore it; a
silenced check is worse than no check. A watchdog must not share the failure mode
of the thing it watches. `|| true` on a command whose success is never verified is
a silent-failure generator. Silence is not success: a script whose only failure
signal is absent output should print something unconditionally. When a validator
passes on input you know is bad, the validator is the bug — test every new gate
against a real failing case before trusting it. Test the rendered artifact, never a
page you patched — a check that constructs the thing it is checking cannot detect
where the real thing is placed. A green pipeline proves the issue was built, not
published; only a live-URL check sees what a reader sees.

**On privacy — non-negotiable.**
The configured finest geography, never finer. No street name as a home marker, no
house number, no personal name of a private individual, no reader or publisher
email, in any issue or any file in the repo. **A lat/lon is an address**, and it
survives a name-based grep. A field's name is not its contents — an innocuous-
looking field can carry an applicant's personal name, and only looking at returned
values reveals it. **Never fetch what must not be published** — omission beats
scrubbing, and a forbidden-fields check at startup beats a comment. Any filter
deciding whether something may be published must **fail closed**: take the
protective branch by default and require positive evidence to release, because the
inputs that defeat a keyword classifier are the ones carrying the least
information, and those are common. Check a privacy change against the previous
*unsafe* output while it is still available. Public dockets are the sharpest test:
the record genuinely is public and an ordinary paper would print the address — this
publication holds a stricter line on purpose, and residential cases are
aggregate-only.

**On research and evaluation.**
Findings from an AI research tool are leads, not sources — check against the
publishing body before repeating anything; "an AI researched it" is not provenance.
Cite the record, not the write-up: citation-counting gates cannot see the
difference. Never average quality — weighted composites let a fatal weakness ride
over the line on seven good scores; gates stay binary, judgement stays graded, the
two never mix. Never let the writing model score its own work — self-assessment
measures confidence. Distrust a new metric more than the thing it measures.
Disclosure is not a substitute for a decision: a figure you could not reconfirm
gets cut, not caveated. Prompt instructions do not move quantitative behavior —
fetchers and gates do; every time a number had to be right, the fix was to fetch
it, not to ask for it.

**On the machinery.**
`issues/` holds the **bare** issue; `build.mjs` adds the chrome — saving a built
page back into `issues/` double-wraps it. The writing agent runs unattended: it
must research inline, never delegate expecting a callback, and never end its turn
before the output file exists on disk. After any architecture change, grep the docs
for old names and paths, and check that every file the workflows reference actually
exists.

---

## Part 2 — The log

Append a dated entry whenever something ships, breaks, surprises, or gets decided —
while it is fresh, not at the end. Format: date, what happened, why it matters,
what to do differently. If the lesson is standing, distill it into Part 1 in the
same commit.

_(no entries yet — /setup writes the first one)_
