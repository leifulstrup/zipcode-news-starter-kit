# The daily digest — design, costs, and honest limits

Some publishers want something every day. In a hyperlocal ZIP, most days genuinely
contain little news — so "publish a full issue daily" would mean paying a full
AI research run to restate yesterday. The daily digest is the deliberate
alternative: a **private, delta-only email to the publisher** that costs
approximately nothing on quiet days. Enable it with `/enable-daily`
(paste: *Read `.claude/skills/enable-daily/SKILL.md` and follow it*).

## Why a delta, not an issue

The weekly issue answers "what should residents know?" — it takes research,
corroboration, and the full gate apparatus, and that is exactly why it is
expensive and why it is weekly. The daily question is different: **"did anything
actually change since yesterday?"** That question has a deterministic answer. A
script compares today's feeds and data against yesterday's recorded state; no
model is needed to detect novelty, only (optionally) to summarize it.

The pipeline:

```
daily-delta.mjs (script, free)
   ├─ nothing new → STOP. No model. No email. (most days, by design)
   └─ something new → small model summarizes ONLY the delta (30-turn cap,
      no research tools) → verify-digest gate → privacy gate → email to publisher
```

## The cost table

| Scenario | Model usage |
|---|---|
| Quiet day (nothing new) | **$0** — the model never starts |
| Active day | One `claude-haiku-4-5-20251001` run, ≤30 turns, summarization only — a small fraction of a weekly research run |
| Weekly issue | Unchanged — full research run, as before |
| Naive alternative: full issue daily | ~7× the weekly cost every week — **this is what the digest exists to avoid** |

Three design choices enforce the ceiling, in code rather than hope: the model
step is skipped entirely on quiet days; the model gets **no
WebSearch/WebFetch/Bash** (nothing to research means no way to burn turns); and
`verify-digest.mjs` rejects any digest containing a URL that isn't in the delta
file, so padding a thin day with "found" content is a gate failure, not a
temptation.

## The send-to-self boundary

The digest is mail **to the publisher, from the publisher's own AgentMail
inbox**. `bin/send-digest.mjs` can send exactly one message to exactly one
recipient, which must equal `daily.deliverTo` in config — there is no list, no
CC, no loop to extend. This keeps the kit's no-mailing-list stance intact (see
`docs/FEEDBACK-INBOX.md` for why that boundary carries real legal weight). If
neighbors ask for the daily too, the answer is the public site and its RSS feed
— never adding their address. An RSS reader gives them the same "what's new"
experience with zero obligations on you.

## How delta detection works

- **Feeds** (`config/feeds.json`): each run fetches every approved RSS/Atom feed
  and reports items whose link/guid has never been seen, capped at 5 per feed
  (plus an "…and N more" count). Seen-keys are remembered in
  `data/daily/state.json` (rolling ~500 per feed).
- **Data** (adapters with `daily: true`): the adapter's fetched block is
  deep-diffed against the last run's block; changed leaf values are reported as
  `path: old → new`. Most weekly series don't move daily — feeds are usually the
  better daily signal.
- **First run** records a baseline and reports a quiet day (with a 3-item
  starter sample per feed, labeled as such) — dumping a feed's entire history as
  "new" on day one would be a lie about novelty.
- State is committed back to the repo by the workflow — the baseline **is** the
  product's memory; losing it would make the next run a first run.

## Tuning

| Knob | Where | Effect |
|---|---|---|
| `daily.maxItems` (12) | `site.config.json` | Total items passed to the model |
| Per-feed cap (5) | `bin/daily-delta.mjs` | Headlines per feed before "…and N more" |
| `daily.sendQuietDays` (false) | `site.config.json` | `true` = a one-line "all quiet" email daily. Default off: daily "nothing happened" mail trains you to ignore the real ones |
| `daily.model` | `site.config.json` | Digest model. Keep it small; the task is summarization |
| `daily.hourUtc` | config + `daily.yml` cron | Delivery hour (UTC — shifts an hour with DST) |

## Honest limitations

- **Feed parsing is dependency-free regex, not a real XML parser.** Common RSS
  2.0 and Atom shapes work; an exotic feed may parse partially. The failure mode
  is a missed or duplicated headline in a private email — acceptable here, and
  exactly why none of this code is shared with the public weekly pipeline.
- **Novelty is keyed on the item's link.** A feed that reposts items under new
  URLs will cause repeats; a feed that updates in place without changing the URL
  won't re-surface.
- **The AgentMail API path may move** — vendor APIs do. If sending 404s, check
  docs.agentmail.to and set the `AGENTMAIL_API_URL` env override; no code change
  needed. Without an API key at all, the digest prints into the workflow summary
  instead — never silently lost.
- **No watchdog covers the digest.** A missing email means a quiet day *or* a
  dead run; only the Actions tab distinguishes them (red X = dead). See
  docs/OPERATIONS.md.

## "I actually want to PUBLISH more often"

That's a different product, and it's one config line: `cronUtc` in
`site.config.json` (plus the matching workflow cron) can run the full issue
pipeline at any frequency. But every issue is a full-cost research run, and in a
low-news ZIP a daily public issue mostly restates itself — the honest-gap rules
will make that visible fast. Recommended path: run weekly in public, run the
digest privately, and let the digest teach you whether your ZIP actually
produces enough news for something faster.
