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
*unsafe* output while it is still available. **A privacy gate that scans
documents cannot see a leak that travels by repo plumbing**: adding a git remote
creates a push URL as well as a fetch one, and a private instance pushed to a
public repo publishes its whole config — name, email, home-area coordinates —
without any issue ever being written. Any remote that exists only to fetch must
have its push URL disabled at creation, and the check for it belongs in doctor. Public dockets are the sharpest test:
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

**On finding sources.** (from field-testing the kit against a rural, a suburban,
and a mid-size-city ZIP)
County names collide across states even worse than city names — verify the state
token in a county domain before reading its catalog. A search engine's AI summary
is never jurisdiction evidence; only the fetched source is. A source whose own
pages cannot positively state its state and county is rejected or parked — absence
of confirmation is disqualifying, not neutral. One plausible row is not coverage —
check whether the volume is plausible for the whole place. A resolving
`data.<state>.gov` domain is not a live portal; check where it lands. Bot-blocked
(403) is not dead — classify it manual-only instead of failing it. A stale official
archive usually means a platform migration; find the successor before declaring the
source dead. Some sources delete their own history — record retention windows and
archive on every run. Institutions rename and reorganize; re-verify
institution-named registry entries quarterly.

**The dangerous failure is the check that passes for the wrong reason.**
Every serious defect found in field testing was green somewhere it should have
been red — and in each case the check was doing exactly what it was written to
do. The gates did not malfunction. They answered a narrower question than the one
being asked of them, and the gap between the two questions is where the defects
lived. Eight, from two instances:

- `verify-issue` confirmed the rank-badge markup was present. **Presence is not
  appearance** — it rendered as a 373px maroon lozenge, because a bare-element
  rule four lines below out-specified the class. Fixed by adding a renderer, not
  a stricter parser.
- Both false figures were **genuinely fetched**. "Every number is fetched, not
  asked for" moved the risk from the value to the *window*: a source retaining a
  rolling twelve months, compared against "same day last year", returns a handful
  of late-filed stragglers; windows anchored to the issue date rather than the
  newest record produced a 68% drop in reported crime that was entirely reporting
  lag. Correct arithmetic, successful queries, false statements about the world.
- `doctor` passed 10/10 while `/setup` told the publisher it "confirms the
  configuration is coherent." It read no config at all.
- The gates' fixture and the file publishers actually inline **were different
  files**, so the shipped stylesheet was never exercised. Three separate defects
  came out of that one gap.
- Then the fixture built to close that gap **prepended** the stylesheet to the
  fixture's own rules instead of replacing them, so the later rules won the
  cascade and the badge measured 21px against the sheet's 26px. The check built
  to prove appearance was proving the wrong thing, green. The failure mode of a
  verification artifact is not that it is absent — it is that it is subtly not
  the thing it claims to represent.
- `git checkout --ours` resolved a config conflict cleanly, passed doctor, and
  silently dropped three new keys. The only symptom was a feature politely
  reporting it had nothing to look up.
- A workflow guard gated thirteen steps and missed the six that spend money,
  because the agent variable is set at job level and stayed true when the guard
  was false.
- An adapter's own reporting-lag warning fired above fourteen days. The lag was
  thirteen. **Never threshold a provenance warning you would want stated every
  time.**

The through-line: **a check earns trust in proportion to how specifically it
could fail.** "Is the markup present" cannot fail on a visual bug. "Is the config
coherent" cannot fail if it never reads the config. A green result is only as
strong as the set of things capable of turning it red.

So, before relying on any check — a gate, a probe, a fixture, a green CI run:

> **Say out loud what it would take for this to go red, and confirm that includes
> the thing you are actually worried about.**

Six of the eight above would have been caught by that one question, asked once.
It costs a sentence. It is the cheapest thing in this file.

There is a mirror image of this, and it is harder to see. A robustness fix can
work so well that it erases the evidence it was needed. The PDF renderer
neutralizes a stray reading-column rule, so an issue that wrongly styles site
chrome renders correctly and nothing anywhere goes red — the defense consumed the
symptom that would have surfaced the mistake. This is not a check answering too
narrow a question; it is a fix removing the question. The remedy is the opposite
one: when you harden something against a class of input, ask what used to go
wrong loudly and now goes wrong quietly, and put an explicit check where the
symptom used to be.

And the inverse of the whole section, which is the cheapest failure of all: **a
gate that can fire on correct input is worse than no gate**, because it trains
its audience to route around it. A fatal chrome check once scanned the raw file
for the word "sitenav" — so an issue whose stylesheet carried the comment *never
style .sitenav here*, written by an author documenting that they were doing the
right thing, would have failed the run and published nothing.


**On writing about the publisher.**
The publication may state facts about its operator only from what the operator
supplied — affiliations, employment, board seats, financial interests,
independence. Not from inference, and not from a reasonable guess. The kit once
auto-asserted independence on every page, which was catchable because it was
identical everywhere; an agent then removed that template claim and wrote its own
bespoke, hedged, first-person version about a publisher nobody had asked, which
was harder to catch for exactly that reason. **Prose that looks authored gets less
scrutiny than prose that looks generated.** Where a disclosure seems needed and
none was given, say so and stop.


**A negative control that does not negate is not a control.**
Every check above had to be *tested* before it could be trusted, which means
deliberately breaking something and confirming the check goes red. That test has
its own failure mode, and it is the quietest one in this file: **if your broken
case produces the same result as your working case, your sabotage did not take.**
You have tested nothing and been told you passed.

Three from the field, all caught only by noticing that results were identical
when they were supposed to differ:

- Disabling a feature by renaming its constant — renamed it *consistently*, so
  the feature still worked. The check's PASS was correct; the test was
  meaningless.
- Grepping three commits for a string, to establish which ones contained it. A
  shell-quoting bug made every command fail silently, so all three returned zero
  — indistinguishable from *the string was never there*. One of them contained
  it, and zero was the convenient answer.
- Building a fixture by *prepending* a stylesheet to the one already in the file
  rather than replacing it. Both versions rendered; the later rules quietly won
  the cascade, so the fixture measured a page no publisher would ever ship.

So, before believing a negative result: **confirm the negative control produced a
different outcome from the positive one.** If both agree, fix the control before
believing either. And never suppress stderr on a command whose output is your
evidence — `2>/dev/null` turns *this failed* into *this found nothing*, and those
are opposite conclusions.

This one is worth more than most of what is above it, because it does not require
knowing what the bug is. It only requires noticing that two cases which should
have disagreed did not.

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
