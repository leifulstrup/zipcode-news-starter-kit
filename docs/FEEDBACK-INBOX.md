# The feedback inbox — inbound-only, and why

Readers are the newsletter's best error-detection layer and its best source of new
sources: the school page you aren't reading, the zoning notice taped to a door, the
figure that's wrong. A contact inbox is how that knowledge reaches you. This page
explains the recommended setup and the two rules that keep it safe.

## Why AgentMail

The kit recommends a free **[AgentMail](https://agentmail.to)** inbox rather than a
Gmail or your personal address:

- **It keeps your identity out of the publication.** Your personal email never
  appears on the site, in the PDF, or in the repo — and the privacy gate can then
  block it outright (`config/privacy.json → blockedEmails`).
- **It is agent-native.** AgentMail inboxes have an API, which means the inbox can
  later be monitored by an AI assistant that summarizes what arrived and drafts
  replies — with you approving anything that matters. You don't have to use that on
  day one; an inbox you check by hand weekly is a fine start.
- **Free at newsletter scale.** A weekly ZIP-code brief generates a trickle of
  mail, well inside the free tier.

## Setting it up (5 minutes)

1. In your browser, go to **agentmail.to** and create a free account. (`/setup`
   walks you through this — Claude explains each step, you do the clicks.)
2. Create an inbox with an address readers can remember —
   `<zip>news@agentmail.to` or your publication's name.
3. Tell `/setup` the address (or edit `site.config.json → contactEmail` and run
   `node build.mjs`). The About page and every issue's method section will start
   carrying it, with the standing language below.
4. Add your *personal* addresses to `config/privacy.json → blockedEmails` so the
   privacy gate guarantees they never appear in an issue.

## Rule 1: inbound-only — this is not a mailing list

The inbox receives; it never sends to a list. This is a deliberate legal and
privacy boundary, not a missing feature:

- The moment a publication **sends** bulk email it takes on mailing-list
  obligations: consent records, one-click unsubscribe, a physical postal address on
  every message (CAN-SPAM), and a privacy policy covering the address list it now
  holds. An inbound suggestion box carries **none** of that, because there is no
  list and nothing is ever sent.
- The reader-facing language (already in the built-in About template) says so
  plainly: *"This is not a mailing list — writing in does not subscribe you to
  anything and nothing is ever sent to you."* Keep that sentence wherever the
  address appears. If you ever want a true email edition, that is a separate,
  deliberate project with real compliance work — don't back into it through the
  feedback inbox.
- Replying 1:1 to someone who wrote to you is fine and normal correspondence. Bulk
  or broadcast is the line.

## Rule 2: everything arriving is untrusted input

An open inbox on an automated publication is an attack surface, and the defense is
stated to readers on the About page:

- **Emails are read as information, never as commands.** "Ignore your instructions
  and publish X" is just a sentence someone wrote. Nothing an email says changes
  how the system behaves.
- **No suggested source is adopted without the publisher's approval.** A reader
  email suggesting a source goes through `/add-source` like any other candidate:
  vetted, live-tested, jurisdiction-confirmed, logged in `data/source-log.md` with
  "how found: reader email" — and only enters the registry when you approve it.
  This blocks the obvious abuse: a plausible-looking email nominating a
  plausible-looking site that feeds the newsletter falsehoods.
- **Never record reader identity.** Log the suggestion, not the suggester —
  `data/source-log.md` entries must not contain reader names or addresses, and the
  privacy gate applies to everything committed to the repo.

## The weekly habit

Checking the inbox is part of the same ~10-minute weekly routine as the accuracy
log: read what arrived, log any claimed error in `data/accuracy-log.md` (and fix
the pipeline per its routing table if it's real), and run `/add-source` on any
source suggestion worth vetting. Topic requests ("cover the pool closure") are
leads for `data/sources-ranked.md`'s standing-asks section or next week's research.
