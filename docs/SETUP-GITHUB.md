# GitHub, from zero

This is the plain-language version of what `/go-live` does. You can follow it by
hand, but the intended path is to let Claude Code drive and read this when you want
to understand what's happening.

## What GitHub is, in this project

GitHub does two jobs here:

1. **It holds the repository** — the single folder that *is* your publication:
   config, scripts, and every issue ever published. No laptop is in the publishing
   path; losing your computer would cost you nothing but convenience.
2. **It runs the weekly job** ("GitHub Actions"): a rented computer wakes up on your
   schedule, fetches your area's data, has the AI write the issue, runs the gates,
   and commits the result. That commit is what triggers publishing.

## Account

Sign up at [github.com](https://github.com) (free). Only you can do this step.
Then, in a terminal, `gh auth login` connects the command-line tool Claude Code uses
to act on your behalf.

## Why your repo is private when the starter kit is public

The starter kit (this framework) is public and MIT-licensed. **Your copy should be a
private repo**: it contains your privacy patterns (your own household's names and
street, recorded so the gate can block them), your source assessments, and your
editorial history. The public face of your publication is the website, not the repo.

A private repo's free tier includes 2,000 Actions minutes/month; a weekly run uses
roughly 160.

## Secrets — the one credential GitHub holds

The weekly job needs exactly one secret to call the AI: either
`CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`, uses your Claude subscription)
or `ANTHROPIC_API_KEY` (from console.anthropic.com, pays per use). Set it with
`gh secret set <NAME>` — that stores it as an **Actions secret**, encrypted, visible
to workflow runs and to nobody else.

Notably absent: GitHub holds **no Cloudflare credential**, and Cloudflare holds no
GitHub secret. The two systems only meet through the repository itself.

Two known traps, both learned the hard way by the reference publication:

- A token copied from a narrow terminal window can pick up an invisible **line
  break** and fail instantly ("total cost $0"). Re-copy with the window widened, or
  `pbpaste | tr -d '\n\r' | pbcopy` on a Mac.
- Secrets are read when a run **starts** — a run already in progress cannot see a
  secret you just added. Re-run it.

## What the Actions tab tells you

- **Green check** on the weekly run: an issue was built and committed. (Cloudflare
  then deploys it — a green run proves *built*, not *live*; the smoke-test workflow
  watches *live*.)
- **Red X**: a gate failed or something broke. **Nothing was published** and last
  week's issue is still up — that is the designed failure mode. Open the run to see
  which step failed; `docs/OPERATIONS.md` has the diagnosis guide.
- The built issue and PDF are attached to every run as **artifacts** (kept 30
  days) — so a run that failed after writing can be recovered without paying for a
  second research pass.

## The issues GitHub will open for you

The watchdog workflows file a GitHub issue — which emails you — when a human is
needed: `review` (verify a claim), `site-down`, `not-published`, `source-down`.
One open issue per label at a time, so a persistent problem doesn't fill your inbox.
When you've addressed one, close it; the watchdog re-files if the problem returns.
