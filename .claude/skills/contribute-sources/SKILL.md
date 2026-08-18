---
name: contribute-sources
description: Share this instance's vetted sources back to the public registry as a pull request — export rows, show the publisher exactly what would become public, then fork, branch and open the PR with the evidence. Use when the user says "contribute sources", "share what I found", "give back to the registry", or after /find-sources or /add-source vets something new.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# /contribute-sources — give back what this instance verified

Every publisher in a county otherwise rediscovers the same sheriff feed, the same
assessor, and the same traps. This instance has already paid that cost. Sharing
it is a pull request to the public registry
(github.com/leifulstrup/zipcode-news-source-registry) — and the publisher
approves every row before anything leaves the machine.

**Nothing here is automatic.** You prepare; they decide. A contribution is
public and permanent, so it gets an explicit yes.

## 1. Explain what contributing means, then get consent

Cover these four points plainly before doing anything:

- **What becomes public**: facts about public data sources — the URL, the
  platform, how to filter it to a ZIP, its lag and cadence, what breaks, what it
  actually measures. The rows carry **no identity**: not theirs, not a resident's.
  The registry's own validator rejects emails, phone numbers, street addresses,
  coordinate pairs and parcel numbers by shape.
- **What a PR reveals anyway**: their GitHub account, and therefore that they are
  interested in these jurisdictions. For most people that is fine. If it is not —
  they publish pseudonymously, or would rather not link their account to their
  ZIP — say so now, and use the registry's **issue template** instead of a PR.
  That path is documented in its CONTRIBUTING.md and costs the registry nothing.
- **Why bother**: corrections come back. Sources they registered get their traps
  and staleness updated by whoever hits them next; when another publisher in
  their county re-verifies a row, this instance sees a fresh date instead of a
  stale one.
- **What it is not**: not a directory of publications, not a mailing list, not a
  claim of authority. Every consumer still live-tests every row.

## 2. Export and read the rows

```
node bin/registry.mjs export
```

This emits CSV rows for sources already approved in `config/sources.json`,
filling what the instance actually knows (adapters know their own lag, cadence
and maturity; `data/sources-ranked.md` carries the quality and insight prose) and
leaving the rest blank. **Blank means unknown — never guess a value to fill a
column**, because the next publisher will trust what is there.

Then read every row **out loud to the publisher**, in plain language, not as CSV.
For each: what it is, what you are claiming about it, and the traps and insights
you would be publishing. Ask them to confirm or drop each one. Watch for:

- **A trap or insight that reveals something about them** rather than the source
  ("useful for tracking the block where…"). Rewrite it as a fact about the data.
- **Anything they consider theirs** — a local contact, a relationship, an
  arrangement. Not for a public registry.
- **Rows they have not actually verified recently.** `last_verified` is a claim
  that someone fetched it on that date. If it is stale, re-verify now or drop it.

## 3. Verify before claiming

For every row going in, confirm the claims are current — the registry's whole
value is that its rows were true when written:

```
node bin/probe-sources.mjs          # adapters' own assertions
```

And for anything not covered by an adapter, use the registry's own diagnostic,
which also fills columns you may not have:

```
git clone --depth 1 https://github.com/leifulstrup/zipcode-news-source-registry.git /tmp/reg
node /tmp/reg/bin/diagnose.mjs <url> --zip <zip>
```

It reports platform, freshness from the data (never the portal's metadata),
retention, padded fields and PII-shaped columns, and prints a draft row. Use its
findings to correct or complete yours.

## 4. Open the pull request

Fork, branch, apply, validate, PR — all of it via `gh`, so the publisher only
approves:

```
gh repo fork leifulstrup/zipcode-news-source-registry --clone=/tmp/reg-fork --remote=false
cd /tmp/reg-fork
git checkout -b add-<state>-<county-or-place>-sources
# merge the exported rows into data/<STATE>.csv, keeping it sorted by
# (county_fips, place_fips, category, source_id) — create the file from another
# state's header if your state has none yet
node bin/validate.mjs                     # must pass before you open anything
gh pr create --repo leifulstrup/zipcode-news-source-registry \
  --title "sources: <jurisdiction>" --body-file <the body you wrote>
```

The PR body is not a formality — it is what makes review possible, since a
maintainer cannot re-verify every source. Fill the repo's pull-request template
honestly: what you ran, what came back, how you confirmed the jurisdiction, and
what the traps would have cost someone who did not know them. Paste the
`diagnose` output where you have it.

**Show the publisher the final diff and the PR body before creating it.** Then
give them the PR URL.

## 5. Record it and hand off

Note in `data/source-log.md`, against each contributed source, that it was
shared upstream and on what date — so a later re-verification knows to refresh
the public row too, and so nobody wonders whether it was already sent.

Tell the publisher: if a maintainer asks for changes, that is normal review of
judgment, not a rejection of their work — and re-verifying a stale row later is a
one-line contribution that helps everyone in their county.
