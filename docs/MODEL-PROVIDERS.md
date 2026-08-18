# Using your preferred LLM provider

Exactly **one step** of the weekly pipeline is model-driven: writing
`issues/<week>.html` from `prompts/write-issue.md` and the week's facts file.
Everything before it (fetching) and after it (privacy gate, verify gate, PDF,
build, publish, watchdogs) is deterministic code that judges the output the same
way **no matter which model wrote it**. That is what makes the provider swappable
with one workflow input.

The kit's default is **Claude** — it is the model the reference publication runs
on, the editorial brief was developed against it, and the onboarding skills in
`.claude/skills/` are built for Claude Code. But the write step has five paths:

| `agent` input | Runs | Credential (GitHub secret) |
|---|---|---|
| `claude` (default) | `anthropics/claude-code-action` | `CLAUDE_CODE_OAUTH_TOKEN` (Claude subscription) **or** `ANTHROPIC_API_KEY` |
| `gemini` | `google-github-actions/run-gemini-cli` | `GEMINI_API_KEY` |
| `codex` | OpenAI Codex CLI (`@openai/codex`) | `OPENAI_API_KEY` |
| `copilot` | GitHub Copilot CLI (`@github/copilot`) | `COPILOT_CLI_TOKEN` (a PAT for an account with a Copilot subscription) |
| `custom` | your own `bin/write-issue-custom.sh` | whatever your script needs |

Pick per-run in the workflow-dispatch dropdown, or set the repo variable
`DEFAULT_AGENT` (`gh variable set DEFAULT_AGENT --body gemini`) to change what the
weekly cron uses.

## The contract every path must meet

Whatever runs in the write step must:

1. Read `prompts/write-issue.md` (the single editorial brief — never fork it per
   provider) and `data/facts/<week>.json`.
2. Do its research inline — no sub-agents, no background tasks (a headless CI turn
   has no callback; anything still running when the turn ends is killed).
3. Leave `issues/<week>.html` on disk and verify it exists before finishing.

The gates do the rest. A provider that writes a beautiful issue with a missing
disclosure, a fabricated figure, or a privacy leak gets rejected exactly like any
other; nothing downstream knows or cares which model ran.

## Per-provider setup

### Claude (default, recommended)

Covered in `/go-live` and `docs/SETUP-GITHUB.md`. Two billing routes:
subscription (`claude setup-token` → secret `CLAUDE_CODE_OAUTH_TOKEN`) or API key
(secret `ANTHROPIC_API_KEY`, then swap the commented lines in `weekly.yml`).
**Only configure the one you use** — an unset secret interpolates to an empty
string, and a blank API key can shadow a valid OAuth token.

### Gemini

Get an API key from Google AI Studio → `gh secret set GEMINI_API_KEY`. Dispatch
with `agent: gemini`. The free tier's rate limits are usually enough for one
weekly run.

### OpenAI (Codex CLI)

`gh secret set OPENAI_API_KEY`. The workflow installs `@openai/codex` and runs
`codex exec` non-interactively. The step passes Codex's
bypass-approvals-and-sandbox flag: on your laptop that flag would be reckless, on
an ephemeral CI runner it is the point — the runner is already disposable and the
agent needs network access for research.

### GitHub Copilot (Copilot CLI)

Requires an account **with a Copilot subscription**; the workflow's built-in
`GITHUB_TOKEN` cannot use Copilot. Create a personal access token for that
account → `gh secret set COPILOT_CLI_TOKEN`. The workflow installs
`@github/copilot` and runs it with your prompt and tool permissions enabled.

### Anything else (`custom`)

Any agentic CLI that can read a prompt file, browse the web, and write a file can
power the kit. Create `bin/write-issue-custom.sh` (and `chmod +x` it):

```bash
#!/usr/bin/env bash
# $1 = week (YYYY-MM-DD), $2 = path to the prepared prompt file.
# Must exit non-zero on failure and leave issues/$1.html on disk on success.
set -euo pipefail
WEEK="$1"; PROMPT_FILE="$2"

# Example shape — replace with your agent CLI of choice:
#   npm install -g some-agent-cli
#   some-agent --yolo --prompt-file "$PROMPT_FILE"

[ -s "issues/$WEEK.html" ] || { echo "agent finished but issues/$WEEK.html is missing"; exit 1; }
```

Add whatever secret it needs (`gh secret set MY_PROVIDER_KEY`) and reference it as
an `env:` entry on the custom step in `weekly.yml`.

## Honest caveats

- **Vendor CLIs move fast.** The `codex` and `copilot` steps invoke third-party
  CLIs whose flags change more often than GitHub Actions do. If one breaks, run
  its `--help` locally, fix the one line in `weekly.yml`, and consider filing the
  fix upstream to this kit.
- **The brief was tuned on Claude.** All providers read the same
  `prompts/write-issue.md`; expect the first issues from a different provider to
  fail gates more often until you've read a few of its drafts. That is the system
  working — the gates, rubric, and accuracy log are how you compare providers on
  evidence rather than vibes. (`QA-QC/measure-issue.mjs` output makes a decent
  side-by-side.)
- **Interactive onboarding is Claude Code.** `/setup`, `/find-sources`,
  `/first-issue`, `/go-live`, `/add-source` are Claude Code skills. They are also
  plain markdown instructions — another agentic CLI can be pointed at
  `.claude/skills/<name>/SKILL.md` and told to follow it — but the blessed,
  tested path for onboarding is Claude Code, even if your weekly writer is
  another provider.
- **One writer per week.** Whichever provider runs, the gates, addendum, and
  accuracy log treat the issue identically — but don't A/B two providers into the
  same live site in the same week; compare on dry runs (`dry_run: true`) instead.
