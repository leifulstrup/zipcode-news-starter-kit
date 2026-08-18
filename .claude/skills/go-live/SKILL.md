---
name: go-live
description: Take the configured, locally-proven newsletter live — GitHub private repo, model credential, Cloudflare Workers Builds, first automated run, monitoring. Use after /first-issue, or when the user says "go live", "publish this", "set up GitHub/Cloudflare".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# /go-live — GitHub, Cloudflare, and the first automated run

You are walking a possibly non-technical user through going live. Do everything you
can yourself; for the things only they can do (browser sign-ups, pasting secrets),
give click-by-click instructions and wait. For interactive terminal commands (logins,
token prompts), tell the user to type `! <command>` in the chat so the command runs
in their session with them at the keyboard. Longer plain-language background lives in
`docs/SETUP-GITHUB.md` and `docs/SETUP-CLOUDFLARE.md` — point to them rather than
lecturing.

Pre-flight: `node bin/doctor.mjs` must be green and at least one issue must have
passed the local gauntlet (/first-issue). If not, stop and send them there first.

## 1. GitHub

1. **Account**: if they don't have one — github.com → Sign up (only they can do
   this). One sentence on what GitHub is: the place the repository lives and the
   machine that runs the weekly job.
2. **CLI auth**: check `gh auth status`. If not logged in, have them run
   `! gh auth login` (choose GitHub.com, HTTPS, login with browser).
3. **Create the PRIVATE repo and push**:
   ```
   gh repo create <workerName> --private --source . --push
   ```
   Explain why private even though the starter kit is public: their copy contains
   their privacy patterns and their editorial history; the published website is the
   public face, not the repo.
4. **Model credential** — the one secret GitHub needs. Two options; explain the
   difference in two sentences:
   - **Claude subscription** (Pro/Max): have them run `! claude setup-token`, copy
     the token, then `gh secret set CLAUDE_CODE_OAUTH_TOKEN` (paste when prompted).
   - **API key** (pay per use): from console.anthropic.com, then
     `gh secret set ANTHROPIC_API_KEY`.
   Two traps to state out loud: the secret must be an **Actions** secret (the `gh
   secret set` default — correct); and a token pasted from a narrow terminal can
   contain a line break that breaks auth — if the first run fails instantly at zero
   cost, re-copy with `pbpaste | tr -d '\n\r' | pbcopy`. The workflow passes only
   the credential that is set — an empty secret shadowing a real one is a known
   failure mode the workflow already guards against.

   If the user prefers a different provider for the weekly writer (Gemini, OpenAI
   Codex, GitHub Copilot, or any agentic CLI via the custom hook), walk them
   through `docs/MODEL-PROVIDERS.md` instead — it lists the secret each path
   needs and the `DEFAULT_AGENT` repo variable that makes the cron use it.
   Claude remains the default and the path the brief was tuned on; say so, then
   set up what they choose.

## 2. Cloudflare

1. **Account**: dash.cloudflare.com → Sign up (only they can do this; free plan).
2. **Connect Workers Builds** — click-path, and get this exactly right:
   - Dashboard → **Workers & Pages** → **Create** → **Workers** → **Import a
     repository** → authorize GitHub → pick their new private repo.
   - Project name: the `workerName` from `site.config.json`.
   - **Build command: `node build.mjs`** · **Deploy command: `npx wrangler
     deploy`** · root directory `/`.
   - Warn them explicitly: these two commands are NOT interchangeable. Putting the
     build command in the deploy slot produces a **green build that deploys
     nothing** — the classic trap.
3. **Verify**: after the first build, the site is at
   `https://<workerName>.<account-slug>.workers.dev`. Have them open it, and check
   in the dashboard that the **Active deployment** matches the latest commit.
4. **Record the URL**: set the repo variable the smoke tests use, and the self host
   in sources config:
   ```
   gh variable set SITE_BASE_URL --body "https://<actual>.workers.dev"
   ```
   Add that host to `config/sources.json` → `self`. If they ever want a custom
   domain like `<zip>.news`, point at `docs/CUSTOM-DOMAIN.md` — it changes nothing
   about this setup except names.
5. Optional: Cloudflare **Web Analytics** (free, cookieless, no consent banner
   needed — the kit's no-tracking stance is a feature; never add Google Analytics).

## 3. First automated run

1. **Dry run first** — no commit, no publish:
   ```
   gh workflow run weekly.yml -f dry_run=true
   gh run watch
   ```
   Read the run summary with the user; artifacts hold the built issue.
2. **Real run** when the dry run is green:
   ```
   gh workflow run weekly.yml
   ```
   When it commits, Cloudflare deploys automatically. Confirm the live URL shows the
   new issue, then run the kit's own check:
   ```
   node bin/smoke-test.mjs --base https://<actual>.workers.dev
   ```

## 4. Monitoring — what happens without them

Explain the standing machinery in plain language (details: `docs/OPERATIONS.md`):

- Every `<publishDay>`, the weekly workflow writes, gates, and publishes an issue.
  **A failed run publishes nothing** — last week's issue stays up; that is the
  designed failure mode.
- Watchdogs open GitHub issues (which email them) labeled **`review`** (a claim
  needs a human look before trusting the issue), **`site-down`** (the site stopped
  serving), **`not-published`** (the week that should exist doesn't), and
  **`source-down`** (a data source broke). One open issue at a time per label.
- **Silence means the system is working.**

Their weekly human habit — the one thing that cannot be automated: the ~10-minute
accuracy check, three claims per issue into `data/accuracy-log.md`. Eight clean
consecutive issues is what earns "(Experimental)" off the masthead. And when they
hear of a new source worth adding: `/add-source`.

## 5. Close out

Commit anything changed (`git add -A && git commit -m "go-live: connect GitHub and
Cloudflare" && git push`). Then say it straight: they now publish a newspaper. It
will write itself weekly; its honesty is enforced by gates; its accuracy is earned
by their ten minutes a week. That last part is the job.
