---
name: enable-daily
description: Opt in to the daily email digest — a private, delta-only radar email to the publisher, built to cost ~nothing on quiet days. Interviews for delivery time/address, wires approved RSS feeds, sets up AgentMail sending, and test-runs the pipeline. Use when the user says "enable daily", "daily digest", "email me the news daily", "publish more often".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# /enable-daily — turn on the private daily digest

Prerequisite: the weekly setup is done (at least `/setup` and `/find-sources`;
run `node bin/next-step.mjs` to check). The digest reuses the source registry —
there is nothing for it to watch before sources exist.

## 1. Explain what they are opting into — before touching anything

In plain language, cover these four points and confirm they want it:

- **What it is:** a short private email, to them only, listing what is
  *genuinely new* since yesterday — new headlines from their approved feeds, and
  changed numbers from their data adapters. A radar, not a publication. The
  public weekly issue is completely unchanged.
- **The cost model:** detecting "what's new" is a plain script — free. The AI
  only runs when something actually changed, on a small model
  (`claude-haiku-4-5-20251001`) with a hard 30-turn cap and **no research tools**
  — it can only summarize the collected delta. A hyperlocal quiet day (most
  days, in most ZIPs) costs $0 in model usage and sends nothing. Contrast: a
  "real issue daily" would be a full research run every day, roughly 7× the
  weekly cost — that is the thing this design exists to avoid.
- **The boundary:** it sends to their own address, and the code physically
  cannot send to more than that one configured recipient. It is not a mailing
  list and must never become one; neighbors who want the news get the public
  site and its RSS feed.
- **What can be thin:** if their sources publish rarely, most digests will be
  quiet. That's the system working — say so now so silence isn't read as
  breakage.

## 2. Interview (one question at a time)

1. **What time do you want it?** Convert their local time + timezone (already in
   `site.config.json`) to UTC for `daily.hourUtc`. Note the DST caveat: GitHub
   cron is UTC, so the local arrival time shifts an hour twice a year.
2. **Deliver to which address?** Their personal email is the natural choice —
   this is mail *to them*. Confirm it is their own address; the digest sends
   from their AgentMail inbox (`contactEmail`) to this address.
3. **Quiet days: silence, or a one-line "all quiet" email?** Default is silence
   (`sendQuietDays: false`) — recommend it; a daily "nothing happened" email
   trains people to ignore the real ones.

## 3. Wire the feeds

The digest watches RSS/Atom feeds from **already-approved sources only**:

1. Read `data/sources-ranked.md` and `config/sources.json`; for each approved
   source likely to have a feed (news outlets, town agenda systems, library,
   civic orgs), find the feed URL (`/feed/`, `/rss`, `/index.rss`, an
   AgendaCenter RSS link) and **verify it live** — fetch it, confirm it parses
   as RSS/Atom and the newest item is recent.
2. Show the user the list; they approve each feed (source-log gets a status
   note: "feed added for daily digest").
3. Write the approved ones to `config/feeds.json` (`{name, url, type, notes}`).
4. If an adapter should be diffed daily (e.g. a permits count), set
   `daily: true` on the adapter object in its own file under `bin/adapters/`
   (adapters are auto-discovered; there is no registry list to edit) — but warn:
   most weekly data series don't move daily; feeds are usually the better
   signal.

## 4. Configure and test locally

1. Set `site.config.json → daily`: `enabled: true`, `deliverTo`, `hourUtc`,
   `sendQuietDays` per the interview. (`loadDaily` supplies model/maxItems
   defaults; only change them if asked.)
2. Rewrite the cron line in `.github/workflows/daily.yml` to match `hourUtc`.
3. **Show the delta mechanics** — run it twice so they see it learn:
   ```
   node bin/daily-delta.mjs
   node bin/daily-delta.mjs
   ```
   First run: "FIRST RUN — baseline recorded" with a small starter sample.
   Second run: quiet (nothing new in the last minute) — explain that tomorrow's
   run will report only items that appeared after today's baseline.
4. Run `node bin/doctor.mjs` — still green before anything ships.

## 5. Email delivery (AgentMail)

1. They need the AgentMail inbox from `/setup` as `contactEmail` (the digest
   sends *from* it). If they skipped it, do that part of
   `docs/FEEDBACK-INBOX.md` first.
2. In the AgentMail dashboard (they do this in the browser): create an API key.
   Then: `gh secret set AGENTMAIL_API_KEY` (paste when prompted).
3. Explain the fallback honestly: without the key, the digest still runs and
   prints itself into the workflow log/summary instead of emailing — nothing is
   lost, it's just not in their inbox.

## 6. Go

1. Commit: `git add -A && git commit -m "daily: enable digest" && git push`
2. Test end to end with a forced send:
   ```
   gh workflow run daily.yml -f force_send=true
   ```
   Then `gh run watch` (or check the Actions tab). They should receive one
   email — subject starting with their publication's name — or find the digest
   in the run summary if AgentMail isn't configured yet.
3. Tell them how to read silence from now on: **no email means a quiet day OR
   a broken run — a red X on the daily workflow means broken.** The
   publication-check watchdog does not cover the digest; the Actions tab does.
4. To disable: set `daily.enabled` to `false`, commit, push. To change time or
   address, re-run this skill.

Append a dated entry to `data/lessons-learned.md` recording what was enabled
and the choices made.
