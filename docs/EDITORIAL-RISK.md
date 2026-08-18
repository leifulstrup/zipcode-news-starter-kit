# Editorial risk: what not to publish, and how to publish the rest safely

**This is not legal advice.** It is a set of editorial practices that reduce
exposure, written by people who are not your lawyer and do not know your
jurisdiction. If you are publishing at any scale, or something here worries you,
talk to a media-law attorney in your state. Many press associations offer free
or cheap hotlines to small publishers.

That said: most of the risk in a hyperlocal publication comes from a short list
of predictable mistakes, and the kit's architecture already avoids several of
them by construction. This page names the rest.

## The one idea that carries most of the weight

**Report the record, in the record's own terms, with a link to it.**

Accurate, attributed accounts of official records and proceedings enjoy strong
protection in US law (commonly called the *fair report privilege*). The
protection attaches to *accuracy and attribution*, not to good intentions — it
covers "the county inspection recorded four violations on August 3," and it does
not cover "the restaurant is filthy," which is your characterization, not the
record's.

Everything below is a consequence of that idea.

## People: the highest-risk category

- **Never name a private individual.** The privacy gate enforces this, and the
  editorial brief repeats it. There is no hyperlocal story that requires naming
  a neighbor.
- **An arrest is not a conviction, and a charge is not a fact about a person.**
  Report crime as counts, patterns and locations — never as individuals. If an
  arrest genuinely must be covered (a public official, an event with no other
  framing), report only what the official record states, name the record, and
  say the charge is unproven. Then ask whether the item is worth the exposure at
  all; usually it is not.
- **Never identify victims**, especially of violent or sexual crime, and never
  anyone who is a minor.
- **Public officials acting in office are different from private residents** —
  their official conduct is legitimately reportable. That latitude covers what
  they *do in the role*, not their family, health, or home.
- **Never generate a quotation.** Already a hard rule in the brief: a fabricated
  quote attributed to a real person is both a factual error and a
  defamation risk in one sentence.

## Businesses: reportable, but stick to the record

Businesses sue too, and "trade libel" is a real cause of action. Inspections,
code enforcement, permits and lawsuits are all legitimately reportable *as
records*:

- Use the **record's own metric** — the score, the violation count, the case
  status — with its **date**. A point-in-time inspection is not a verdict on a
  business.
- **Report re-inspections and remediation** where the record has them. Publishing
  a failure and omitting the subsequent pass is inaccurate by selection.
- **Do not rank or aggregate into a judgment.** "The four dirtiest restaurants in
  town" is your claim; "these four scored below X on their most recent
  inspection, dated Y" is the record's.
- **Do not infer.** A health violation is not "an outbreak." A code-enforcement
  case is not "a slumlord." A lawsuit filed is not a wrong committed.
- **Link the record** so a reader — and the business — can check it.

Health inspections are worth covering: they are genuinely useful, genuinely
public, and usually well-structured data. They are also the single most common
place a small publication oversteps, because the temptation to characterize is
strong and the record is unglamorous.

## Topics to avoid entirely

Not because they are unreportable in principle, but because the risk-to-value
ratio is bad for an automated, unreviewed publication:

- **Anything presented as professional advice** — legal, medical, financial, tax,
  real-estate, or safety guidance. The About page already disclaims it; do not
  undercut that by writing "you should…" about a regulated subject.
- **Individual disputes** between neighbors, landlords and tenants, or parents
  and a school. There is no version of this that is safe without reporting both
  sides, which an automated pipeline cannot do.
- **Ongoing litigation characterized beyond the filing.** Report that a case
  exists, its number, its posture. Not who is right.
- **Speculation about anyone's immigration status, health, finances, criminal
  history, or membership in a protected class.**
- **Anything sourced only to social media or a neighborhood app.** Unverifiable,
  frequently wrong, and often about identifiable private people.
- **Missing-person, active-emergency, and unfolding-crime items.** A weekly brief
  is the wrong instrument, and being both slow and wrong is the worst outcome.

## Copyright and attribution

- **Summarize and link. Never reproduce.** Do not republish another outlet's
  article text, photographs, or graphics. A one-or-two-sentence summary with a
  link and a byline credit is standard practice and low-risk.
- Facts are not copyrightable; *expression* is. Rewriting someone's story in your
  own words is fine. Copying their sentences, or their distinctive selection and
  arrangement, is not.
- Government works are usually free to use, but not always at state and local
  level, and photographs on a government site may be licensed from someone else.

## Corrections reduce exposure, not just embarrassment

A prompt, visible correction is both the honest thing and — in many
jurisdictions — a factor in limiting damages. The kit already ships the
machinery: `data/accuracy-log.md`, the corrections language on the About page,
and the standing rule that where the publication and an official source
disagree, **the official source governs and the publication is wrong**.

Two habits worth keeping: fix the *pipeline* when a class of error appears (move
the number into a fetcher, add a gate), and never quietly alter a published
issue — the archive is a record, and silent edits destroy the thing that makes a
correction credible.

## What the kit already enforces for you

You are not starting from zero. Already mechanical:

- No reader- or publisher-identifying information (privacy gate: names, streets,
  house numbers, coordinates, parcel numbers).
- Death and violence claims require an official incident source **in the same
  section** (Tier A gate) — and if you cannot source it, it does not run.
- Failed fetches must be admitted in print; an issue that hides one is rejected.
- No fabricated quotations; no unsourced figures; no invented case numbers.
- AI-authorship disclosure everywhere a reader can arrive, so nothing is passed
  off as human reporting.
- "Leads, not findings" framing, telling readers to follow the source before
  acting.

The gates cannot judge *tone*, *selection*, or *characterization*. That is what
this page is for, and it is why the rubric asks about framing restraint every
week.
