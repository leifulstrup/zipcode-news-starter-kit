# Changelog

## [0.14.1] — 2026-08-20

### Changed
- **Removed the About page's claim that archived issues are never retroactively
  corrected.** Publisher's decision. It was a binding promise the kit made on
  every publisher's behalf, and it foreclosed a policy many publications
  legitimately choose — appending a correction to the archived piece where the
  error was made, so a reader who finds the wrong issue also finds the
  correction. The kit should not commit a publisher to an editorial policy they
  did not choose.

  What remains is the part that is true regardless: *always check an issue's date
  before relying on it — an issue reports what the sources said on the day it was
  written.*
- `docs/OPERATIONS.md` no longer asserts the same promise on the publisher's
  behalf. It now says plainly that how a published issue is corrected is the
  publisher's policy to set and to state, presents the reference publication's
  default as a default rather than a rule, and points at `--eject-about` as where
  to write whatever they decide.

*Verified: the claim is absent from the rendered About page; the Corrections
section still stands on its own and still states the post-publication accuracy
check. Reasoned: nothing.*

## [0.14.0] — 2026-08-20

### Changed
- **The About page is now an editorial artifact you own, not build output.**
  `node build.mjs --eject-about` writes the generated prose once as a bare
  fragment — the same contract `issues/` already uses — and from then on the
  build uses your file and never regenerates it. Instances that never eject are
  unaffected.

  The reason is sharper than convenience: that page carries the corrections
  policy, the privacy statement, the independence claim and the not-advice
  disclaimer — the sentences a publication is judged on and, if challenged, held
  to. Regenerating it every build meant a publisher could not fix a sentence (the
  fix was overwritten on the next run), and the page silently rewrote itself when
  unrelated config changed. **The most durable prose on the site was the only
  prose nobody owned.** (Publisher's design decision; prototyped by the 90706
  field instance.)

### Fixed
- **The About page promised coverage the publication had told readers it could
  not provide.** The beat list is built from `sections`, which is a statement of
  intent, not of sourcing — a field instance shipped a page promising two beats
  its own issue said in print it had no source for. The generated default now
  carries a note to the publisher to name only sourced beats, and `/first-issue`
  walks them through fixing it at ejection time.
- **With no `contactEmail`, the entire corrections apparatus vanished.** The page
  said errors are expected, that past issues are never retroactively corrected —
  and then dropped the whole reporting block, leaving readers of a wrong issue no
  route by which they could ever learn it was wrong. The kit's own doctrine is
  that a gap is admitted in print, not deleted. It now keeps a Corrections
  section that explains how accuracy is actually checked, states the eight-issue
  bar, and says plainly that no reporting address exists yet.

### Added
- **A doctor check for the half-updated state that is otherwise invisible**: an
  instance that owns `about.html` then merges a `build.mjs` without support for
  it. The file survives, is silently ignored, the site quietly reverts to
  generated prose, and every check stays green. Same shape as `--ours` dropping
  config keys.

*Verified: ejection writes the file and refuses to overwrite; an edit to
`about.html` reaches `public/about/index.html` after a rebuild; the no-inbox page
keeps its Corrections section and admits the missing route; the doctor check is
inert without `about.html`, passes with a supporting build, and fails with a
build lacking support (exit 1). Reasoned: nothing.*

## [0.13.3] — 2026-08-19

### Fixed
- **A fatal gate could fire on correct input.** The double-wrap check scanned the
  raw file for the bare words `sitenav` / `issuebar` / `sitefoot` /
  `site-chrome`, so an issue whose stylesheet carried the comment *"never style
  .sitenav here"* — an author documenting that they were doing the right thing —
  would have **failed the run and published nothing**. It would also fire on a
  source URL, an addendum quotation, or any issue that discusses the kit. It now
  matches the markup (`class="sitenav"`, `id="site-chrome"`) with stylesheets and
  HTML comments excluded. **A gate that can fire on correct input is worse than
  no gate: it trains its audience to route around it.**

  Found while testing v0.13.2's new warning, which strips comments for exactly
  this reason — two adjacent gates guarding the same concept, one hardened and
  one not, and the un-hardened one was the fatal one. It was unreachable by luck
  rather than design: the shipped stylesheet's header happens to say "the nav,
  issue bar, footer" in spaced words, and v0.13.2's own warning message writes
  them as class names, one natural edit away.

### Added
- **A coda to the Part 1 section**, drafted by the field instance: the mirror
  image of a check that passes for the wrong reason is **a fix that works so well
  it erases the evidence it was needed**. Not a check answering too narrow a
  question — a fix removing the question. Remedy runs the opposite way: when you
  harden something against a class of input, ask what used to go wrong loudly and
  now goes wrong quietly, and put an explicit check where the symptom used to be.
  Plus the inverse failure above, as the section's closing line.

*Verified: an issue whose stylesheet comment names all four chrome classes now
passes (exit 0); the genuinely double-wrapped fixture still fails fatally on the
intended message (exit 1); doctor green. Reasoned: nothing.*

## [0.13.2] — 2026-08-19

### Added
- **`verify-issue` warns when an issue's stylesheet declares rules for site
  chrome** (`.wrap`, `.sitenav`, `.issuebar`, `.sitefoot`). The existing check
  catches chrome *markup*; nothing caught chrome *CSS* — and the injected print
  stylesheet neutralizes a stray `.wrap` rule so effectively that such an issue
  renders correctly in the browser and in the PDF. An instance could style
  chrome, pass every check, and look fine everywhere. **A defense that works so
  well it erases the evidence it was needed** is the same shape as everything in
  Part 1's list, so it now leaves a trace. Declarations only — the shipped
  stylesheet's own comments legitimately name these selectors to tell authors not
  to style them.

*Verified: the warning fires on an issue carrying real `.wrap`/`.sitenav` rules,
and does not fire on the shipped stylesheet whose comments mention them; doctor
green. Reasoned: nothing.*

*Also settled this release: the v0.13.0 claim marked "reasoned, not verified" —
that stripping `.wrap` from the sheet has no effect on the PDF path — was
independently A/B-tested by the field instance and holds for three separate
reasons (the PDF renders the bare issue, which has no `.wrap` element; the print
column comes from `@page` margins; and the injected print CSS already neutralizes
any such rule). Rendering with a hostile `.wrap{max-width:380px;padding:60px}`
produced an identical 9-page PDF, 117-byte delta, metadata only.*

## [0.13.1] — 2026-08-19

### Added
- **`data/lessons-learned.md` Part 1 gains the pattern the field tests kept
  producing**, drafted by the second field instance and merged substantially as
  written: *the dangerous failure is the check that passes for the wrong
  reason.* Eight instances, each with the scar attached — presence is not
  appearance; both false figures were genuinely fetched; doctor passed while
  claiming to check a config it never read; the gates' fixture and the file
  publishers inline were different files; the fixture built to close that gap
  then measured a cascade no real issue would have; `--ours` dropped three keys
  silently; a guard covered thirteen steps and missed the six that spend money;
  a lag warning thresholded at fourteen days when the lag was thirteen.

  The rule: **a check earns trust in proportion to how specifically it could
  fail** — and the question to ask before relying on one: *say out loud what it
  would take for this to go red, and confirm that includes the thing you are
  actually worried about.* Six of the eight would have been caught by asking it
  once.

*Verified: the section renders in the shipped file and doctor stays green.
Reasoned: nothing — this release is documentation.*

## [0.13.0] — 2026-08-19

### Changed
- **The kit now ships the reference publication's ACTUAL stylesheet.**
  `fixtures/house-style.css` is the real sheet from 20015.news, contributed by
  its publisher and MIT-licensed with the rest of the kit — 13.5 KB, the full
  designed palette (`--ink-soft`, `--ink-faint`, `--card`, `--accent-soft`,
  `--rule-strong`, plus semantic green/amber/blue), every class the brief's
  markup implies, and the responsive block. The three colour tokens the kit
  already exposes are filled from `site.config.json`; the rest is a designed
  palette a publisher may edit deliberately.

  It replaces a sheet written independently from a *prose description* of that
  design — which diverged in ways nobody could see without comparing rendered
  pages, most consequentially using flex where the original uses grid, so the
  front-page panels never stacked on a phone. **A first issue now looks right on
  day one instead of looking like a first issue**, and a whole class of
  "why doesn't mine look like the reference" is gone.

  Site chrome is stripped out: the nav, issue bar, footer, `.wrap` reading
  column and site-level mobile typography stay `build.mjs`'s, because two files
  styling the same thing disagree and the one you are not looking at wins.

### Fixed
- **The styled fixture was being generated wrong**, and would have proved the
  wrong thing. It *prepended* the house stylesheet to the fixture's own minimal
  rules instead of *replacing* them, so those later rules won the cascade — the
  rank badge measured 21px against the house style's 26px. Now generated by
  `bin/make-styled-fixture.mjs` (`npm run fixture`), which replaces the block,
  and doctor regenerates before rendering so it can never go stale relative to
  its two inputs.

## [0.12.1] — 2026-08-18

A field instance diffed `fixtures/house-style.css` against the reference
publication's live stylesheet and asked which of three things the differences
were. The answer was a fourth, and it explains the pattern: **the kit's
stylesheet was written independently from a prose description of the reference
design, never transcribed from it** — while `build.mjs` WAS ported from the
reference implementation. Two halves of one design with different ancestry, and
nothing rendered a page to notice they disagreed.

### Fixed
- **The front-page summary panels never stacked on a phone.** `build.mjs`'s
  injected mobile block collapses them with `grid-template-columns: 1fr` — a
  property a **flex** container ignores entirely — while the stylesheet used
  `display: flex`. On every phone, in every kit-built issue, the two panels sat
  squeezed side by side. `.fp-cols` is now `grid`, with a comment stating that
  the layout mode is a contract with `build.mjs` and must change on both sides
  together.
- **An issue was not responsive as a standalone artifact.** The responsive rules
  lived only in the chrome `build.mjs` injects, so an issue opened straight from
  `issues/` — which the kit's architecture explicitly supports — had none. The
  stylesheet now carries its own `@media` block for its own components.
- Missing design tokens (`--ink-soft`, `--ink-faint`, `--card`, `--accent-soft`,
  `--rule-strong`); front-page items had no separator rule; `.fp-p` was serif
  body copy, so the summary read as more article rather than as a summary column
  — it is now smaller sans in a receded ink, which is the single biggest visual
  difference the diff turned up.
- **The brief demanded something the reference publication does not achieve.**
  "The front summary must fit exactly one page" — the reference's own PDF runs
  five items and two panels onto a second page. As written, a diligent instance
  would keep cutting good material to meet a rule its source of truth violates.
  Now: open the issue and run no more than about two printed pages.

### Added
- **render-check asserts mobile**, at a 390px viewport: the summary panels must
  stack, and nothing may overflow horizontally. Verified by reintroducing the
  flex version. Mobile is not a smaller desktop — it is where most readers are,
  and it is where a layout-mode mismatch hides.
- The brief now states that **a CSS layout mode is a markup contract**, with the
  `.aibar` as the worked example: it is a flex row expecting exactly two
  children, and bare text with several `<b>` elements makes flex promote each to
  its own column, rendering the disclosure bar as ragged columns of a broken
  sentence.
- `fixtures/good-issue.html` gained the two front-page panels the brief
  requires — again, the fixture must exercise what the brief mandates, or the
  gates test a shape nobody ships.

## [0.12.0] — 2026-08-18

### Added
- **`/contribute-sources`** — share this instance's vetted sources back to the
  public registry as a pull request, with the mechanics handled and the judgment
  left to the publisher: export the approved rows, read each one aloud in plain
  language, re-verify anything stale, then fork/branch/validate/PR via `gh`. The
  publisher sees the final diff and PR body before it is created. Contribution
  is never automatic — a public, permanent row gets an explicit yes.
- The skill names two things a publisher should decide with open eyes: rows carry
  **no identity** (the registry's validator rejects emails, phones, addresses,
  coordinates and parcel numbers by shape), but **a pull request carries a GitHub
  account**, so anyone who would rather not link their account to a ZIP code
  should use the registry's issue template instead. A contribution someone feels
  safe making is worth more than one they don't.

## [0.11.1] — 2026-08-18

### Fixed
- **The v0.11.0 unconfigured-copy guard missed the six steps that cost money.**
  It gated 13 steps individually, but `AGENT` is set at **job** level, so
  `if: env.AGENT == 'claude'` on each writer step stayed true and the writer ran
  anyway — the friendly notice appeared in the log of a failed run. Worse: an
  instance that had a credential but an unfinished `/setup` would not merely have
  failed, it would have **invoked the model to write an issue for ZIP 00000 and
  been billed for it**. Everything the guard successfully protected was free;
  everything it missed was not.

  Fixed structurally, not with six more `&&` clauses (which is the same shape
  that just failed and rots on the seventh writer path): a **`preflight` job**
  computes `configured`, and the `issue` job carries a single
  `if: needs.preflight.outputs.configured == 'true'`. One condition now gates all
  25 steps — including any nobody has written yet — and an unconfigured copy
  renders as a **neutral skip rather than a red failure**. `daily.yml` gets the
  same treatment: config gate at job level (opt-in is knowable up front), runtime
  quiet-day gate still per-step (only knowable after the delta is collected).
- **`/update-kit` silently dropped new config keys.** `site.config.json` is
  listed as instance-owned, and `--ours` resolves its conflicts cleanly, passes
  doctor — and discards every key an update added. A real instance lost
  `stateCode`/`countyFips`/`placeFips` this way and was left quietly unable to
  use the shared registry, which reported only "no stateCode, nothing to look
  up." Config files are now a named **fourth hand-merge case**: they merge by
  **key**, not by file — keep the instance's values, add the kit's new keys, and
  fill them in deliberately, because `/setup` will not run again for an existing
  instance.

## [0.11.0] — 2026-08-18

### Fixed
- **CRITICAL, visual: the front-page rank badge rendered as a 373px maroon
  lozenge on every item of every issue.** A specificity inversion inside the
  shipped stylesheet: `.fp-item > div { flex: 1 }` (0,1,1) out-specifies
  `.fp-rank` (0,1,0), and the brief's own mandatory template makes *both* the
  badge and the body `> div` children — so the 30px circle computed to
  `flex-grow:1`. It passed privacy-scan, verify-issue, measure-issue, normalize,
  the PDF render, build, and doctor 13/13. **Presence is not appearance**, and
  nothing in the kit closed that gap.
- **Four of the seven classes the brief's mandatory front-page template requires
  were never styled at all.** `.fp-where` computed to full body size — the
  per-item source line read as part of the story — and `.lbl` computed to plain
  body text, so **"Why it matters:", the one inline clause the brief names
  explicitly and forbids replacing with a callout box, rendered invisibly.**
- **`/go-live` step 1.3 assumed the ZIP path while the README recommends the
  template path.** On the template path the repo already exists, so
  `gh repo create --source . --push` creates a *second* repo, re-points origin,
  pushes there, and orphans the original along with its workflow registrations —
  leaving two repos, one live and one the user believes is live. Now branches on
  `git remote get-url origin`, and states that the repo name and `workerName` are
  independent.
- **Every workflow is registered and ACTIVE the moment a repo is created from the
  template — before `/setup` has ever run.** `daily.yml` guarded this; `weekly.yml`
  did not, so a copy created Monday and abandoned mid-interview fires Friday's
  cron with placeholder ZIP 00000, fails, and emails its owner a red X for a
  publication that does not exist — breaking "silence means the system is
  working" before they finish the interview. `weekly.yml` now exits green with a
  helpful notice while the ZIP is still `00000`.

### Added
- **`bin/render-check.mjs`** — the durable answer to presence-is-not-appearance.
  Loads the styled fixture in the browser the kit already uses for PDFs and
  asserts what a reader sees: the rank badge is square-and-round, and elements
  the brief requires to stand out (`.lbl`, `.fp-where`) actually differ from the
  text *they sit in* — not from `document.body`, which a 16px label inside a
  16px paragraph would trivially "differ" from. Skips itself with instructions
  when no browser is installed; wired into doctor, `/first-issue`, and
  `npm run render-check`. Verified by reintroducing both real defects.
- `fixtures/good-issue.html` now uses the brief's **full mandatory template**
  (`.fp-body`, `.fp-p`, `.lbl`, `.fp-where`) — the fixture must exercise what the
  brief requires, or the gates test a shape nobody ships.
- Brief §4b: **when an item turns on a scheduled decision, carry the meeting's
  TIME and any statutory deadline on the same page.** A field instance printed a
  vote's date but not that it was a *special* meeting at 9:00 a.m. rather than
  the regular 7:00 p.m. slot (a reader acting on it arrives twelve hours late),
  and missed a statutory deadline two days later that decided the matter.
  Neither was a wrong claim; both sat further down a notice already cited.
  **Stopping when the story is good enough is how the useful part gets left out.**

## [0.10.1] — 2026-08-18

Second field instance, `/first-issue` complete: gate-clean issue, 12-page PDF,
39 citations, 75% primary hosts. It was the first to test `fixtures/house-style.css`
as intended, and found that following the brief exactly shipped a bug to readers.

### Fixed
- **HIGH, user-visible: a CSS comment was parsed as a front-page headline.** The
  shipped stylesheet contained `/* headline: <p class="fp-h"><b>…</b></p> */`;
  the brief says to inline the whole sheet; and both `build.mjs` and
  `verify-issue.mjs` scanned the raw file for `<p class="fp-h">`. Sitting in
  `<style>` at the top of the document, the comment became the **first** extracted
  headline — so every archive entry and every RSS description led with a phantom
  "…" item, and verify reported one more front-page item than existed (an
  instance at the 6-item ceiling would have been told it had 7). Fixed at the
  cause: **`<style>`/`<script>` are stripped before any content-structure scan**,
  in both files. Also fixed the instance (the comment now describes in words) and
  added a standing warning to the stylesheet against literal markup in comments.
- **The gates' fixture and the file instances inline were different files**, so
  nothing ever exercised the gates against what publishers actually ship. New
  `fixtures/styled-issue.html` inlines `house-style.css` exactly as the brief
  instructs; doctor now verifies it passes and that **inlining the stylesheet adds
  no phantom headlines** — verified against a deliberate reintroduction.
- **Two gate requirements existed nowhere in the brief.** `class="frontpage"`
  (FATAL) and the not-professional-advice disclaimer (FATAL) were enforced only
  in `verify-issue.mjs`, so a writer following the brief faithfully failed the
  gate twice with no way to learn except reading the gate source. Both are now in
  the brief — the front-page wrapper in the Structure markup block, the
  disclaimer as a fifth disclosure place — and both failure messages now name the
  brief section to read. (The irony was the tester's: `verify-issue.mjs`'s own
  header says rules "never live only in the brief," and these lived only in the
  gate.)

### Added
- Brief §4a: **a date read out of an extracted PDF table is not verified until
  the column order is confirmed** against a row where the pairing is unambiguous.
  Text extraction flattens columns into one stream, so a naive read pairs a name
  with the wrong date — found in a real agenda packet. Agenda packets are PDFs
  everywhere.
- `/first-issue` now states as a **standing rule** what two instances have now
  confirmed: when `measure-issue` reports zero on something the brief requires,
  the draft has usually written *around* the requirement rather than met it.
  Investigate before dismissing — the natural reaction to an advisory number is
  to wave it off, and that reaction has been wrong nearly every time.

## [0.10.0] — 2026-08-18

Second field instance, `/find-sources` complete (6 adopted, 5 rejected, 4
parked, one working adapter). Its lead finding is not a bug in any file — it is
a gap in the threat model, and the most serious thing found in the kit so far.

### Fixed
- **CRITICAL (class): a fetched, arithmetically correct, gate-clean number that
  is a false statement about the world.** Fetching guarantees the *value* is
  real; it does not guarantee the *comparison*. Two instances hit on one
  afternoon on a single adapter:
  - **Window anchored to the issue date over a lagging source.** The newest
    window silently holds fewer days of data than the one it is compared with.
    Measured: 62 against 196, publishable as "reported crime down 68%" — the
    real figure, with both windows anchored to `max(date)`, was −29%.
  - **Year-over-year against a rolling-retention source.** The source keeps ~12
    months and does not hold last year, so the prior-year query returns the few
    late-filed stragglers still inside the window: 16 against 1,493, which
    prints as a five-figure percentage increase.

  Neither is fabrication, so `verify-issue` had nothing to say: both queries
  succeeded, both figures were fetched, both computations were correct. Fixes:
  **`_template-arcgis.mjs` now anchors every window to `max(date_field)`** and
  **probes retention before computing any year-over-year**, emitting an
  `agentRule` that forbids the comparison when the source is rolling rather
  than silently computing a meaningless one. `verify-issue.mjs` gained two
  warnings for the signatures (a measured window ending past `dataThrough`; a
  prior-period figure under a fifth of the current one). `bin/adapters/README.md`
  §9b and README philosophy point 1 now state plainly that **the window is where
  the risk now lives**.
- **Never threshold a provenance warning you would want stated every time.** A
  field adapter guarded its incompleteness rule with `if (lagDays > 14)`,
  measured 13, and the guard never fired — the threshold silently disabled the
  only check that would have caught the bug. The template now states the lag
  unconditionally.
- **`data/facts/<week>.json` is now privacy-scanned** in the weekly workflow. It
  is committed to the repo and adapters can pull coordinate fields; the daily
  workflow already scanned its outputs, so the omission was an oversight — and
  `privacy-scan.mjs`'s own header documents a coordinate that survived two
  text-based scrubs inside a data file.
- Both adapter templates said to "register it in `bin/adapters/index.mjs`" —
  stale since v0.7.0's auto-discovery, and contradicting the registry file whose
  hand-registration caused the four-silently-unhooked-adapters incident.

### Changed
- **`/find-sources` now requires an explicit keep-or-drop decision per standing
  section**, rather than leaving it to the agent's judgment about whether the
  list "fits". The shipped 11-section list is DC-derived and does not survive a
  78k-person city: a field instance found three sections with no vetted source
  behind them. A section with no source is a standing invitation to pad.
- **"Does my ZIP cross municipalities" now names the Census ZCTA-to-Place
  relationship file**, and warns that a spatial `intersects` query answers a
  different question — it counts a shared boundary edge. In the field it
  returned seven cities for a ZCTA lying 100% inside one of them, which would
  have put the opposite of the truth into every issue forever.
- **Freshness rule extended**: confirm the date field is a real date *type*
  before trusting `max()` over it. A layer advertising yesterday's `modified`
  date, whose string `M/D/YYYY` field sorts "9/7/2019" to the top, actually
  stopped in 2023. Derive freshness from a numeric year when the date is a string.
- ArcGIS Hub portals: the working search route is `orgId` from the portal page
  then `arcgis.com/sharing/rest/search?q=orgid:<id>` — Hub v3's `filter[orgid]`
  is rejected. Also: a `data.<county>.gov` portal may be ArcGIS Hub, not Socrata.

## [0.9.0] — 2026-08-18

### Added
- **A shared, community-vetted source registry.** Working out what a county
  publishes is the most expensive step in the kit — 30–60 minutes per instance —
  and it is almost entirely duplicated: LA County has ~250 ZIPs whose publishers
  would each rediscover the same sheriff feed, the same assessor, and the same
  traps. The kit now reads
  [zipcode-news-source-registry](https://github.com/leifulstrup/zipcode-news-source-registry)
  before searching, via `bin/registry.mjs` (`lookup` / `search` / `export`).
  Design and rationale: `docs/SHARED-REGISTRY.md`.
  - **Keyed on jurisdiction, not ZIP** (state/county/place FIPS): sources are
    jurisdiction-scoped — a sheriff serves dozens of cities — so this is ~100×
    smaller than a ZIP-keyed table and gives reverse lookup for free. `/setup`
    resolves and stores `stateCode`/`countyFips`/`placeFips` once.
  - **25 attributes per source**, because the URL is the least valuable part:
    `platform` (the product — Socrata, ArcGIS, Accela, Tyler…), `update_cadence`,
    `lag_days`, `data_maturity`, `history_start`, `retention`, `quality`, plus
    `traps` (what breaks your code) and `insights` (what changes how you write).
    `platform` is the field that **transfers across jurisdictions** — an Accela
    portal behaves the same in any state.
  - **Leads, not authority**: every entry is still live-tested, still requires
    the publisher's approval, still logged. A poisoned row is worth no more than
    a poisoned search result. Data only — patterns are read and adapted, never
    fetched and executed. No contributor identity, ever.
  - Degrades completely gracefully: unreachable or absent registry prints one
    line and the normal sweep proceeds.
- **`docs/EDITORIAL-RISK.md`** and a new brief section (§1c): report the record
  in the record's own terms, with a link. Arrests are not convictions; businesses
  are reportable as records not verdicts (inspection scores with dates and
  re-inspections, never rankings); no professional advice; skip individual
  disputes, characterized litigation, social-media-only sourcing and unfolding
  emergencies; summarize and link, never reproduce. Explicitly not legal advice.
- Adapters can now declare `platform`, `lagDays`, `dataMaturity`, `retention` and
  friends (`bin/adapters/README.md` §11) so `registry export` can share what an
  instance learned.

## [0.8.0] — 2026-08-18

All three findings from the second field instance's `/setup` run (ZIP 90706),
worst first.

### Fixed
- **HIGH: a smoke test could be scheduled 23 hours BEFORE the publish it
  verifies, and pass forever.** `/setup` named only `weekly.yml`, while the
  instruction to move the other two schedules lived as a comment inside files
  nobody had reason to open. The arithmetic bites hardest on the kit's own
  recommended cadence: a Pacific 4pm publish is 23:00 UTC, so the smoke test
  "one hour later" belongs on the NEXT UTC day — bumping only the hour digit
  schedules it 23 hours early, where it passes every week against the previous
  week's site and never alerts, because a passing watchdog is the silence this
  system is designed to produce. Every US Pacific publisher following the kit's
  own advice lands in that band. **New `bin/sync-crons.mjs` derives all
  schedules from `cronUtc`** (with the weekday rollover), `/setup`,
  `/enable-daily` and `/update-kit` call it instead of hand-editing, and doctor
  asserts the files agree. Modular arithmetic on weekday indices is not a task
  for a human or an agent at 4pm on a Friday.
- **MEDIUM: `/setup` claimed doctor "confirms the configuration is coherent"
  when doctor never read the configuration.** It was purely a gate self-test
  against fixtures and would have passed identically with a placeholder worker
  name and three contradictory schedules — worse than no check, because the
  publisher reads green and stops looking. Doctor now checks the config it was
  said to check: schedules derive from `cronUtc`, `wrangler.toml` name matches
  `workerName`, and no placeholder values survive a configured instance.

### Added
- **`/setup` now proves the publisher's own privacy patterns catch their own
  hazards** before handing off: it generates a throwaway probe from the values
  just entered (coordinate pair, bare lat/lon at the configured prefixes,
  second-person phrasing, each name and street marker, a parcel number),
  runs the gate, shows the hits, and deletes the probe. Doctor proves the
  gate's *built-in* patterns; nothing proved *this instance's*, so a typo'd
  surname or a latitude off by a digit yielded a silently weaker gate showing
  green. Thirty seconds, and it converts "I filled in a form" into "I watched
  it catch me."
- **Assessor parcel numbers as a privacy hazard.** `/setup` now asks whether
  the county publishes them and in what shape (formats are county-specific, so
  it asks rather than shipping one national regex). A parcel number pastes into
  a county portal and resolves to exactly one property — an address that hides
  from a name search, the same sentence as the coordinate rule, in the local
  dialect. Permits, code enforcement and sales feeds all carry them.

### Changed
- **`/setup` no longer writes the publisher's personal email into
  `blockedEmails`.** The privacy gate already blocks every address at the big
  consumer providers generically, so listing it added zero coverage while
  writing the exact identifier the file exists to suppress into a committed
  file. It now asks only for addresses at non-personal providers (work,
  university, vanity domain) — the ones the generic rule genuinely misses.

## [0.7.8] — 2026-08-18

### Added
- **`/setup` now checks whether you started from a stale template copy** — right
  after doctor, before any configuration. A repo made from a GitHub template is
  a snapshot with no link back, so a copy taken from an older release has no way
  to know it is behind; this happened to a real publisher, who discovered it
  eight releases later. The check compares `package.json` against the latest
  release and offers to update first, because **updating before configuring is
  nearly conflict-free while updating after customization is a real merge** (a
  field instance that updated late worked through twenty conflicts; the same
  update run early took one). README's Quickstart now says to take the copy from
  the latest release for the same reason.

## [0.7.7] — 2026-08-18

### Fixed
- **`next-step.mjs` called `/find-sources` done when nothing had been
  approved.** It treated any dated row in `data/source-log.md` as evidence the
  step was finished — but the log records **rejections** too, so an instance
  that vetted ten candidates and approved none was told to move on with an
  empty registry. Completion is now judged only on approved sources in
  `config/sources.json`; the log is history, not roster.

### Added
- **Partial-progress reporting in `next-step.mjs`.** "You have started this but
  not finished it" is a different instruction from "start this." It now reports
  in-progress states: candidates logged but none approved, `geographyNote`
  still empty, a missing adapter registry.
- **`.github/workflows/kit-ci.yml`** — the kit self-tests on Node 20/22/24/
  latest (`fail-fast: false`), running doctor, a fresh-clone build,
  orientation, the zero-adapter fetch path, all three watchdog scripts, and
  measurement — so the README's "Node 20+" claim stays true rather than
  aspirational, and deprecation warnings surface here instead of in a
  publisher's weekly run. No secrets, no network, no cost. (Second field
  instance, ZIP 90706.)

## [0.7.6] — 2026-08-18

### Added
- **Run `doctor` first, and say what it proves.** `node bin/doctor.mjs` passes
  8/8 on a fresh unconfigured clone — it tests the gates against fixtures, not
  against your config — but nothing surfaced that, so a new publisher's first
  question ("did I download something broken?") went unanswered until after a
  ten-minute interview. It is now step 2 of the README Quickstart and step 1 of
  `/setup`, with the reassurance stated explicitly. It also catches a bad Node
  install before the user invests any answers. (Second field instance, ZIP
  90706.)

## [0.7.5] — 2026-08-18

### Fixed
- **Corrected upgrade guidance for v0.7.4.** Instances that applied either
  v0.7.4 workaround by hand did so in `.git/config`, which is not
  version-controlled: there is nothing to conflict and nothing to undo. The
  kit's fixes are in tracked files and arrive with the merge; the state they
  correct already matches on a hand-patched instance, so the new doctor checks
  simply pass. Both `/update-kit` commands are idempotent and safe to re-run.

### Added
- **An honest coverage statement** (docs/TESTING.md): exactly what has been
  exercised in a real instance and what has never executed by anyone —
  Cloudflare Workers Builds, the first automated run, `SITE_BASE_URL` and
  live smoke tests, all four watchdog workflows, a live digest send, and
  `/go-live` past its opening steps. A kit that implies coverage it does not
  have is doing the thing it tells publishers not to do. Includes the field
  test's parting recommendation: **test `/go-live`'s early steps in isolation**
  — most of its failure surface is repo state and command shape, testable
  without an account or a cent, and that is where both of its worst bugs were.
- A concrete case for the published-issues-only rule in `data/accuracy-log.md`:
  a 6 correct / 0 misleading / 0 wrong record that was zero-eighths of the way
  to the bar, because every check was pre-publication.

### Field test closed
The 90744 instance concluded after six reports and six releases (v0.7.0–v0.7.5),
two of the fixes then verified back in the same instance. It ends with two
gate-clean unpublished issues, five adapters, 25 logged source candidates, and
no automation armed (no credential exists, so nothing is half-live). Its own
retrospective lives in that private repo.

## [0.7.4] — 2026-08-18

**Update strongly recommended for every instance that has run `/update-kit`.**
Both fixes concern repo state that `/update-kit` created; if you have updated
before, run `node bin/doctor.mjs` after taking this release — it now detects and
prints the fix for both conditions.

### Fixed
- **PRIVACY: the template remote was push-capable to a public repo.**
  `git remote add` creates a push URL as well as a fetch URL, so every updated
  instance had a working route by which `git push template` — or a `--all`
  push, or an agent being helpful — would publish that private instance,
  including `config/privacy.json` (publisher name, personal email, home-area
  coordinate prefixes), into the public template repository. The privacy gate
  could not see it: the gate scans issues, not repo plumbing. `/update-kit` now
  creates the remote with `git remote set-url --push template DISABLED`, with a
  do-not-"fix"-this comment, and doctor fails on any non-origin remote that is
  still pushable.
- **`/update-kit` silently broke every `gh` command in `/go-live`.** With two
  remotes, `gh` cannot resolve the repo and fails with "multiple remotes
  detected" — at the step where a non-technical publisher is already out of
  their depth, caused by an unrelated, successful, possibly weeks-old step.
  `/update-kit` now runs `gh repo set-default` (resolved from `origin`'s URL,
  since `gh repo view` is itself ambiguous once two remotes exist), `/go-live`
  carries explicit `-R <owner>/<repo>` on `gh secret` commands (which ignore the
  default — a gh quirk, documented so nobody tidies it away), and doctor
  detects the unresolved state and prints the one command that fixes it.

### Added
- **Repo-state checks in `bin/doctor.mjs`** (2 new checks, verified in all four
  states): they catch a repo left in a condition that will break a *later* step,
  as distinct from the fixture gates.
- **The cross-skill release-checklist question** (docs/TESTING.md): *does this
  change alter repo state that a later skill depends on?* — with the
  push-capable-remote and gh-resolution cases as worked examples, and the rule
  that the diagnosis belongs in doctor rather than in a document.

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

Entries mark **what was verified against a running instance** versus what was
reasoned from the code, because a reader deciding what to re-check deserves to
know where the author's own confidence is lowest. Field-test findings say which
instance found them.

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
