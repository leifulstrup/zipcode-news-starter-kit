# zipcode-news-starter-kit

**Version 0.4.1** — see [CHANGELOG.md](CHANGELOG.md) for what's changed and how
the kit is versioned.

Build an AI-written, gate-checked weekly newsletter for your ZIP code — one you own
and operate, published on your own site, for free-tier money.

This kit is the generalized framework behind [20015.news](https://20015.news), a
working weekly brief for one Washington, DC ZIP code. Everything here — the
pipeline, the quality gates, the editorial rules — was learned by running that
publication and is shipped so you can run yours.

## What you get

- **A publication, not a demo.** A static website (current issue on the homepage,
  dated permalinks, archive, About page), a multi-page **PDF** of every issue, and
  an **RSS feed** — no JavaScript, no tracking, no cookies.
- **A weekly pipeline** on GitHub Actions: a script fetches your area's data, an AI
  agent researches and writes the issue, automated gates check it, and a commit
  publishes it through Cloudflare. Your laptop is not in the loop.
- **Quality machinery**: a privacy gate and a publication-promises gate that block a
  bad issue from publishing; a seven-question craft rubric; an accuracy log; and
  watchdog workflows that email you when something needs a human.
- **Claude-guided setup**: open this folder in Claude Code and four skills walk you
  through everything, including creating GitHub and Cloudflare accounts if you've
  never used either.

## What it costs

| Thing | Cost |
|---|---|
| GitHub (repo + weekly automation) | Free tier is enough |
| Cloudflare (hosting at `<name>.workers.dev`) | Free tier is enough |
| The AI writing run | A Claude subscription (Pro/Max) or API usage |
| Custom domain like `12345.news` (optional) | ~$10–50/year |

## Quickstart

You need [Claude Code](https://claude.com/claude-code) and
[Node.js](https://nodejs.org) (v20+). Then:

1. **Get your copy**: click **Use this template** on GitHub (or download the ZIP)
   — don't fork; your copy will become a private repo with your own settings.
2. **Start Claude Code from inside the kit folder**, then type **`/setup`**:

   ```
   cd path/to/your-copy
   claude
   ```

   The folder matters: the `/setup`, `/find-sources`, etc. commands are part of
   this kit, and Claude Code only registers them from the folder it was launched
   in. If any of them comes back **"Unknown command"**, either restart Claude Code
   from inside the kit folder — or skip the slash command and tell Claude:
   *"read `.claude/skills/setup/SKILL.md` and follow it."* Every skill works
   either way.

The four skills, in order:

| Skill | What it does | Time |
|---|---|---|
| **`/setup`** | Interviews you (ZIP, name, schedule, privacy), configures everything, first local build, git init | ~10 min |
| **`/find-sources`** | Discovers the data sources and outlets around your ZIP — open-data portals, police/311/permits/sales data, local outlets — tests each one live, and registers only what you approve | 30–60 min |
| **`/first-issue`** | Writes a real issue entirely locally, runs it through every gate, and reads it with you against the rubric. Nothing is published | ~30 min |
| **`/go-live`** | GitHub private repo, Cloudflare hosting, the model credential, first automated run, monitoring | 30–45 min |

Prefer doing it by hand? The same ground is covered in `docs/SETUP-GITHUB.md` and
`docs/SETUP-CLOUDFLARE.md`.

## How it works

![Architecture: your machine runs the Claude Code onboarding skills and pushes to a private GitHub repo; GitHub Actions fetches data, has the model write the issue, gate-checks it, builds HTML/PDF/RSS and commits; Cloudflare Workers Builds watches main and deploys the static site to readers](docs/architecture.svg)

Three systems, one handoff. Your machine (with Claude Code) configures and grows
the newsletter; GitHub Actions researches, writes, gate-checks, and builds each
issue on schedule; Cloudflare serves whatever is committed. **The git repo is the
only connection between them** — GitHub never holds a Cloudflare credential,
Cloudflare never runs a model, and a failed quality gate commits nothing, so the
deploy never fires and last week's issue stays live.

This diagram is generated from your own `site.config.json` by
`bin/render-architecture.mjs` — after you run `/setup` it shows *your*
publication's name, ZIP, publish day, and URL, and the weekly workflow
re-renders it so it can never go stale.

## The philosophy, briefly

Five ideas carry the whole design; the reference publication learned each one the
hard way.

1. **Every number is fetched, not asked for.** Deterministic scripts pull the data
   before the AI writes; the writing model must not contradict what was fetched and
   must admit what wasn't. Every time a figure had to be *right*, the fix was to
   fetch it — a prompt instruction alone never moved the needle.
2. **Gates, not promises.** A rule that can be enforced in code never lives only in
   the prompt. Two gates — privacy and publication promises — exit nonzero before
   anything is committed. **A failed run publishes nothing**, and last week's issue
   stays up. That is the designed failure mode.
3. **Disclosure everywhere.** Readers are told an AI wrote this — on the page, in
   the PDF, in the feed, in the metadata — and the masthead carries
   "(Experimental)" until eight consecutive issues with a clean accuracy record
   make it eligible for removal — and you explicitly approve the change. Nothing
   removes that label automatically.
4. **Leads, not findings.** The publication tells readers to follow the sources
   before acting; where it disagrees with an official source, the official source is
   right. Every section ends with its own source list, URLs printed visibly.
5. **The repo is the handoff.** GitHub Actions writes and commits; Cloudflare
   watches the repo and serves it. Neither holds the other's credentials. Rollback
   is `git revert`.

## The weekly rhythm, once live

- Your issue publishes automatically every week. A red X in the Actions tab means
  nothing published and last week's issue is still live — by design.
- **Your ten minutes**: verify three claims from each issue against their cited
  sources and log them in `data/accuracy-log.md`. This is the one thing that cannot
  be automated, and it is what earns "(Experimental)" off your masthead. Check the
  feedback inbox in the same sitting — reader corrections feed the accuracy log,
  reader source-suggestions feed `/add-source` (see `docs/FEEDBACK-INBOX.md`).
- Heard of a new source — a reader tip, a neighbor's mention, something the weekly
  research flagged? **`/add-source`** vets it and, with your approval, registers it.
- GitHub emails you when a workflow opens a labeled issue:

| Label | Meaning |
|---|---|
| `review` | The issue published, but a claim needs a human look |
| `site-down` | The live site stopped serving |
| `not-published` | The week that should exist, doesn't |
| `source-down` | A data source broke or changed shape |

**Silence means the system is working.**

## Repo map

| Path | What it is |
|---|---|
| `site.config.json` | Your publication's identity — the one config |
| `config/sources.json` · `config/privacy.json` | Source trust classes · privacy-gate patterns |
| `build.mjs` | Generates the whole site from `issues/` |
| `bin/` | The deterministic pipeline: fetch, gates, PDF, monitoring |
| `bin/adapters/` | Data-source adapters for your area's APIs |
| `prompts/write-issue.md` | The editorial brief — the single source of truth the AI writes from |
| `.claude/skills/` | `/setup`, `/find-sources`, `/first-issue`, `/go-live`, `/add-source`, `/write-issue` |
| `.github/workflows/` | Weekly publish + three watchdogs |
| `issues/` | Your published issues (bare HTML + PDF) — the only editorial artifacts |
| `data/` | Facts files, source registry, source-log, lessons-learned, accuracy log |
| `QA-QC/` | The seven-question rubric and issue measurement |
| `docs/` | Setup guides, operations runbook, evaluation method, the Contract |

Start with `docs/CONTRACT.md` if you want to understand how the pieces agree with
each other, and `docs/OPERATIONS.md` for how it runs and what to do when it breaks.

## Trust & safety

Four non-negotiables, enforced by gates rather than promises:

1. **No reader-identifying information.** No addresses, no names of private
   individuals, no coordinates (a lat/lon is an address that hides from a name
   search). The privacy gate blocks all of it — including your own household's
   identity, which `/setup` records precisely so it can never leak.
2. **AI disclosure at every surface** a reader can arrive at.
3. **Per-section attribution** with visible URLs and query dates.
4. **Failed fetches are admitted in print.** An issue that hides a failed query is
   rejected — that is the exact shape of a fabricated number.

Also deliberate: **no mailing list** (emailing readers imports consent records,
CAN-SPAM obligations, and a stored address list onto a site whose privacy surface is
otherwise zero — the RSS feed is the subscription), **no analytics by default**
(Cloudflare's cookieless analytics is the only sanctioned option), and **no source
enters the registry without your explicit approval** — including sources readers
suggest.

The kit does recommend an **inbound-only feedback inbox** (a free
[AgentMail](https://agentmail.to) address, set up during `/setup`): readers write
in with corrections, tips, and source suggestions; nothing is ever sent back to a
list. The inbox is explicitly labeled "not a mailing list" everywhere it appears,
every email is treated as information — never as instructions — and reader-suggested
sources go through the same `/add-source` vetting and your approval like any other
candidate. See `docs/FEEDBACK-INBOX.md` for the setup walkthrough and the two rules
that keep it safe.

## FAQ

**Do I need to know how to code?** No. Claude Code runs every command and explains
what it's doing; the docs cover the few things only you can do (browser sign-ups,
pasting a secret).

**`/setup` or `/find-sources` says "Unknown command."** Claude Code was started
from a different folder (or the session began before you cloned the kit). Quit and
relaunch from inside the kit folder (`cd your-copy && claude`) — or just tell
Claude to *"read `.claude/skills/<name>/SKILL.md` and follow it"*, which does the
same thing without a restart.

**Do I need to buy a domain?** No. Your site runs free at
`<name>.workers.dev`. A custom domain is an optional later upgrade
(`docs/CUSTOM-DOMAIN.md`).

**What does a week actually cost to run?** The Actions minutes fit the free tier.
The writing run is the real cost: covered by a Claude Pro/Max subscription token, or
a few dollars of API usage per issue depending on model and research depth.

**Can I use a different model?** Yes. Only one pipeline step is model-driven, and
the gates judge its output no matter who wrote it. The weekly workflow ships five
paths — Claude (the default and the one the brief was tuned on), Gemini, OpenAI's
Codex CLI, GitHub Copilot CLI, and a `custom` hook for any other agentic CLI. One
brief, any writer: see `docs/MODEL-PROVIDERS.md` for setup and honest caveats.

**How do I stop it?** Disable the workflows in your repo's Actions tab (or delete
the repo). The site stays up until you remove the Cloudflare project. To skip a
single week, add the date to `data/skipped-weeks.txt`.

**What if my ZIP has almost no data?** The kit degrades honestly: fewer sections, a
shorter issue that says what isn't published for your area — never padding.
`/find-sources` will tell you plainly what it found and didn't.

## Credits

Framework extracted from [20015.news](https://20015.news), an experimental
AI-written weekly for one DC ZIP code, and its operating lessons — see
`data/lessons-learned.md` for the ones shipped with the kit.

MIT License — see [LICENSE](LICENSE). Build a hundred of these.
