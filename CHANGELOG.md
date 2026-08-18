# Changelog

## [0.7.3] — 2026-08-18

### Fixed
- **Owners metric vocabulary** (measure-issue Q4): an issue that explicitly
  contrasted "renters rather than owners" scored 0 while a weaker issue scored
  1 off an incidental "property values". Bare `owners?` now matches; the
  documented tradeoff is that a false positive costs a five-minute
  investigation and a false negative costs what the metric exists for.

### Added
- **Regression-fire protocol** (QA-QC/README.md): expect false positives and
  treat them as fair price — investigate before fixing; if the metric missed
  the phrasing, widen the metric, never the prose (inserting a magic phrase to
  satisfy a counter is gaming the instrument); if the dimension is really gone,
  the fix goes in the brief.
- **Standing-page doctrine** (brief §4a + find-sources registry guidance): an
  agency publishes dated notices and standing project pages about the same
  thing, and they are different sources — citing only the notice produced "a
  closure is scheduled" where the project page said sixteen months. Register
  the standing page on the cadence; the notice is what it currently emits. Each
  hop from the authoritative artifact loses the parts that make the story worth
  publishing.
- **The "(Experimental)" bar counts PUBLISHED issues only**
  (data/accuracy-log.md): pre-publication calibration checks are logged but do
  not advance the eight-issue counter — the label is a promise about the
  published record, and a record nobody could read proves nothing to the people
  the promise is made to.

## [0.7.2] — 2026-08-18

### Added
- **Regression detection in measure-issue** (advisory): after archiving an
  issue's measurement, it compares against the previous edition's and warns
  when a Q4 interest-breadth or Q5 actionability sub-metric drops to zero from
  non-zero. Field-tested rationale: a rubric fix that lives in one issue's text
  is a patch, not a fix — "renters named" went 0 → fixed to 4 → back to 0 one
  issue later with every gate green. A drop to zero on a dimension the
  publisher already decided matters is more actionable than any absolute score.
- Editorial brief: how to explain a **declined Tier A item** without tripping
  the Tier A gate (describe the decision without the trigger vocabulary — the
  gate stays blunt on purpose; an opt-out wrapper would be a hole for shipping
  uncorroborated claims); the **shared-street-name boundary trap** (an arterial
  crossing the city line turns the next city's crime into false local news —
  place the block, or it doesn't run as local); and the **stale-feed
  restatement rule** (an unchanged figure from a lagging source must say it is
  the same window restated, or it manufactures a trend out of a lag).

### Verified in the field (no code change)
- The v0.7.0 adapter auto-discovery migration: a real instance's update went
  from 20 conflicts (v0.4.0→v0.6.0) to 1 (v0.6.0→v0.7.0, resolved exactly per
  the migration note) to 0 (v0.7.0→v0.7.1), with five instance adapters
  loading unchanged. The lag-zero gate fired correctly on its first real
  outing. "Better honest and thin than padded" survived a real quiet week.

## [0.7.1] — 2026-08-18

### Added
- **`bin/adapters/_reference-lag-aware.mjs`** — the first field instance's
  adapter mechanics as a documented reference (underscore-prefixed, never
  auto-loaded): the lag-zero contract in code, the lag-artefact-zero guard, the
  withheld verdict (a rate comparison across windows of different day-of-week
  composition is invalid regardless of the denominator), point-in-polygon
  geography with the filter-broke-vs-genuinely-nothing distinction, and all
  four probe shapes.
- **The semantic probe** (probe shape 4, adapters README §2): assert every
  assumption the adapter's *meaning* depends on — a classification regex that
  quietly stops matching collapses a split into one misleading total with all
  gates green. Plus: string conventions are per-dataset, never per-agency.
- **Calls-for-service doctrine** (editorial brief §4d): dispatch feeds mix
  officer-initiated records with public calls (46% officer-initiated in one
  measured week); the raw total rises when patrols increase. Determine the
  fraction before publishing; never present the undifferentiated total as
  neighborhood demand.

The kit's version lives in `package.json` and is tagged in git (`v<version>`).
Every improvement lands here: **patch** for fixes and doc corrections, **minor**
for new capabilities or new rules the skills/gates enforce, **major** for changes
that break an existing publisher's instance (config schema, issue HTML contract,
workflow interface). Format follows [Keep a Changelog](https://keepachangelog.com);
dates are UTC.

Release procedure, in one line: bump `package.json`, add the entry here, commit,
then `git tag v<version> && git push --tags && gh release create v<version>
--latest --title "..." --notes "<this entry>"` — every version is a [GitHub
Release](https://github.com/leifulstrup/zipcode-news-starter-kit/releases), not
just a tag.

Publishers: your own instance's editorial history belongs in `data/lessons-learned.md`
and git — this file tracks the **kit framework** only. After pulling a kit update
into your instance, run `node bin/doctor.mjs` before your next publish.

## [0.7.0] — 2026-08-18

Everything in this release comes from the first full field test of a real
instance (ZIP 90744, Wilmington CA): three reports covering a v0.4.0→v0.6.0
`/update-kit` merge, a cold-start onboarding run, and a side-by-side layout
comparison against the reference publication.

### Fixed
- **Adapter registrations can no longer be wiped by a kit update** (high
  severity): `bin/adapters/index.mjs` now auto-discovers every non-underscore
  `.mjs` file in `bin/adapters/` — adapter files register themselves by
  existing, so no instance state lives in a kit-owned file. Before this, the
  update merge rule "kit files take the update" replaced an instance's
  hand-edited registry with the empty default: four working adapters silently
  unhooked, every gate green, next issue written with no local data. Migration:
  each adapter file must `export const adapter = {...}` (or default); a broken
  adapter file is a fatal load error, never silently skipped. `/update-kit`
  documents the pre-0.7 migration and requires an adapter-count check.
- **First issues no longer render at full viewport width**: the injected chrome
  styled a `.wrap` reading column that nothing emitted. `build.mjs` now owns it —
  injects `<div class="wrap">` around the issue body when the issue doesn't
  bring its own, and the chrome CSS carries the 760px column rule.
- `/update-kit` hardening from the live merge: README.md and derived
  `architecture.svg` classified; `data/lessons-learned.md` named as dual-owned
  (Part 1 merges from kit, Part 2 is instance history); "expect every touched
  file to conflict — normal for unrelated histories"; workflow conflicts:
  take the kit file wholesale then re-patch cron lines; `probe-sources` added
  to the verify list; arrive-with-the-update caveat for pre-0.5 instances.

### Added
- **The lag-zero contract** (`bin/adapters/README.md` §9, enforced as WARNs in
  `verify-issue.mjs`): a source that lags returns a true 0 for a window it has
  not covered yet, and "none this week" printed from it is fabricated. Count
  blocks now carry `dataThrough`; verify warns on a zero total whose
  `dataThrough` predates the issue week, and on zero totals with no
  `dataThrough` at all. Plus: measure the last complete window, name it in
  print, and withhold verdicts on partial windows (day-of-week composition).
- **`fixtures/house-style.css`** — the reference look as a parameterized
  stylesheet (CSS custom properties fed from config colors). The editorial
  brief now says "start from this" for first issues instead of describing the
  style in prose, which produced structurally-correct visually-generic issues.
- **Geography doctrine** (`bin/adapters/README.md` §10): the three ways a
  dataset can lack your ZIP and the right fix for each; never trust a place
  name or bounding box where a boundary test is available.
- **Assert-meaning traps, named** (from live incidents): portal `updatedAt`
  lies — query `max(date_field)`; padded fields make equality filters return
  0-with-200 — use LIKE/numeric filters and cross-check a group-by; a 200 with
  an empty body is a failure; probe the trap, not just the happy path.
- **measure-issue runs in the weekly pipeline** (advisory, after the
  rubric-unchanged guard, never blocking) and in `/first-issue`'s gauntlet —
  its counts caught an audience-breadth failure three gates missed. Docket
  regex widened (Project/File/Council File/CF) with a
  zero-can-be-a-measurement-gap note.
- Editorial brief: the cost of a secondary source is omission, not error (read
  the record behind the write-up); inside a big city, attribute items by
  project location, never by a release's lead — same-city neighborhoods are the
  urban version of the adjacent-jurisdiction trap.
- README's update section now carries a **copy-paste block that bootstraps
  `/update-kit` from upstream** for instances that predate it.
- find-sources: multi-municipality ZIPs reframed as common (urban too);
  same-named abbreviations/slugs as a decoy class — confirm a civic body by a
  published address or boundary, never by name, initials, or URL.
- setup: guard against capturing an "Other" option label as the user's answer.
- first-issue: expect the PDF step to need `npx playwright install chromium` on
  a fresh clone.

## [0.6.0] — 2026-08-18

### Added
- **Optional daily email digest** (`docs/DAILY-DIGEST.md`, `/enable-daily`): a
  private "what's genuinely new since yesterday" radar emailed to the publisher
  via AgentMail — send-to-self only, enforced in code (exactly one recipient,
  must match `daily.deliverTo`), never a mailing list. Cost model: delta
  detection is deterministic (`bin/daily-delta.mjs` — RSS feeds by unseen links,
  daily-flagged adapters by block diff, committed state); a **quiet day runs no
  model and sends no email (~$0)**; an active day runs one small-model
  summarize-only pass (default Haiku, ≤30 turns, web research disabled in the
  workflow's allowed tools, not just the prompt). `bin/verify-digest.mjs` gates
  the output: every URL must trace to the delta file, so recycled or invented
  items cannot pad a slow day. Privacy gate runs on the digest too. Disabled by
  default; `/enable-daily` interviews, wires feeds from the approved registry,
  sets the AgentMail secret, and test-fires before enabling the cron.
- **`/update-kit`** — pulls upstream template improvements into an instance:
  connects the template remote (template copies have no git link to the
  template), summarizes the CHANGELOG versions you're behind before changing
  anything, merges with a strict ownership rule (your config/sources/issues/
  schedules always win; kit code takes the update), then verifies with doctor/
  build/next-step. README gains "Getting kit updates into your copy" + FAQ.

## [0.5.0] — 2026-08-18

### Added
- **`bin/next-step.mjs` (`npm run next`)** — deterministic onboarding orientation.
  Inspects the folder's actual state (placeholder config, registered sources,
  local issues, live-site host) and prints where you are in the four-step
  journey, what's done, and the exact sentence to paste to any Claude for the
  next step. Motivated by field testing: most early confusion was about
  *sequencing and invocation*, so orientation now lives in code where it works
  identically regardless of the assisting model's capability. Live-state
  detection reads what `/go-live` writes into the repo, not the git remote (a
  fresh clone has a remote from minute one).

### Changed
- README Quickstart now leads with the paste-one-sentence interface (works in
  every Claude surface); typed `/commands` are presented as a terminal-user tip.

## [0.4.2] — 2026-08-18

### Fixed
- **Typed skill commands don't work in Claude Cowork / the desktop app** (second
  live-testing report): Cowork's input box only recognizes built-in commands, so
  typing `/first-issue` shows "isn't a recognized command here" regardless of
  setup. Quickstart, FAQ, and every skill hand-off now distinguish the two
  environments and lead with the invocation that works everywhere: *"read
  `.claude/skills/<name>/SKILL.md` and follow it"* — a typed `/command` is only a
  terminal shortcut for that.

## [0.4.1] — 2026-08-18

### Fixed
- **"Unknown command: /find-sources" during onboarding** (found in live testing):
  Claude Code registers the kit's slash commands only when launched from the kit
  folder, so a session started elsewhere (or before cloning) can't see them. The
  README Quickstart now says to `cd` into the folder before launching, a FAQ entry
  covers the symptom, and every skill's hand-off to the next skill teaches the
  no-restart fallback: "read `.claude/skills/<name>/SKILL.md` and follow it" —
  every skill works both ways.

## [0.4.0] — 2026-08-18

### Added
- **Config-driven architecture diagram in the README**: `bin/render-architecture.mjs`
  generates `docs/architecture.svg` from `site.config.json`, so after `/setup` the
  diagram shows *your* publication's name, ZIP, publish day, URL, and
  feedback-inbox state. `/setup` and `/go-live` regenerate it when config changes,
  and the weekly workflow re-renders it before every commit — a derived artifact
  kept fresh by machinery, not habit (the stale hand-refreshed diagram was a
  documented failure of the reference implementation). Deterministic output with a
  label-overflow guard.

## [0.3.0] — 2026-08-18

### Added
- **Feedback inbox guidance** (`docs/FEEDBACK-INBOX.md`): `/setup` now recommends
  and walks through a free AgentMail.to inbound-only inbox — explicitly not a
  mailing list (nothing is ever sent to readers; the boundary that keeps
  consent-record/CAN-SPAM obligations off the table), every email treated as
  information never instructions, reader-suggested sources gated through
  `/add-source`, reader identity never logged.
- **Multi-provider weekly writer** (`docs/MODEL-PROVIDERS.md`): the `agent` input
  now offers `claude` (default) / `gemini` / `codex` (OpenAI Codex CLI) /
  `copilot` (GitHub Copilot CLI) / `custom` (your own `bin/write-issue-custom.sh`),
  all sharing one prompt contract and judged by the same gates. `DEFAULT_AGENT`
  repo variable selects the cron's writer.
- **Versioning**: `package.json` version, this changelog, and git tags.

### Changed
- Removing "(Experimental)" from the masthead now explicitly requires the
  publisher's approval: the accuracy-log bar makes the label *eligible* for
  removal; no agent or automated process may flip `experimental` — it is proposed
  with evidence and changed only on the publisher's say-so (CONTRACT §2,
  `data/accuracy-log.md`, README).

## [0.2.0] — 2026-08-17

### Changed
- Hardened `/find-sources` with findings from a three-ZIP field test (rural ME,
  suburban Cook Co. IL, Springfield MO name-collision case): state-qualified
  search templates; dead-portal check; ArcGIS org-search technique; county-name
  disambiguation tactics; search-AI summaries are never jurisdiction evidence;
  unconfirmable jurisdiction is disqualifying; official-records SEO-clone warning;
  volume-plausibility live tests; county crosswalk / two-step adapters;
  manual-only class for bot-blocked sources; retention windows + archive-on-run;
  stale-platform successor rule; quarterly re-verification of institution-named
  registry entries.
- `docs/TESTING.md` results log filled with the three field-test rows;
  durable rules distilled into `data/lessons-learned.md` Part 1.

## [0.1.0] — 2026-08-17

Initial release. Generalized framework extracted from
[20015.news](https://20015.news): config-driven static-site builder
(HTML/PDF/RSS), publication gates (privacy scan, verify-issue) with a doctor
fixture harness, Seven Questions QA rubric (v1.1), adapter-based open-data fetch
layer, four GitHub Actions workflows (weekly publish + three watchdogs), and
Claude-guided onboarding skills (`/setup`, `/find-sources`, `/first-issue`,
`/go-live`, `/add-source`, `/write-issue`) with an append-only source-discovery
log.
