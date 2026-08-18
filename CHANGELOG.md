# Changelog

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
