# Cloudflare, from zero

The plain-language version of the hosting half of `/go-live`.

## What Cloudflare does here

Cloudflare serves your website. Specifically, this kit deploys a **Cloudflare Worker
with static assets**: `wrangler.toml` declares `[assets] directory = "./public"` and
no server code, so the "Worker" is just a fast global file server for the site that
`build.mjs` generates. The free plan is more than enough.

**This is NOT Cloudflare Pages.** Pages is a different Cloudflare product with
different build/deploy commands. The reference publication wrote this down wrongly
twice, which is why it gets its own warning: if you follow a Pages tutorial you will
end up with commands in the wrong slots and a **green build that deploys nothing**.

## How deploys happen

**Workers Builds** watches your GitHub repo. On every push to `main` it runs:

| Field | Value | What it does |
|---|---|---|
| Build command | `node build.mjs` | Regenerates `public/` from `issues/` |
| Deploy command | `npx wrangler deploy` | Uploads `public/` to the edge |
| Root directory | `/` | |

These two commands are **not interchangeable**. `node build.mjs` in the deploy slot
leaves the build implicit: the step exits 0, Cloudflare shows green, and nothing was
deployed. After any configuration change, confirm the **Active deployment** version
in the dashboard matches your latest commit.

`public/` is gitignored — Cloudflare regenerates it on every build; your repo only
ever holds `issues/`.

Note the clean split: Cloudflare has read access to your GitHub repo (granted when
you connect it) but holds no GitHub secret, and GitHub holds no Cloudflare
credential. The commit is the whole interface. Rollback = `git revert` + push.

## Click-path

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free plan).
2. **Workers & Pages → Create → Workers → Import a repository**.
3. Authorize GitHub, select your private repo.
4. Project name = `workerName` from your `site.config.json`.
5. Enter the build/deploy commands from the table above. Save and deploy.
6. Your site: `https://<workerName>.<your-account-slug>.workers.dev`.
7. Tell the repo about it:
   `gh variable set SITE_BASE_URL --body "https://<that url>"` — the smoke-test
   workflow checks the live site there — and add the host to
   `config/sources.json` → `self`.

## Analytics (optional)

**Cloudflare Web Analytics** is free, cookieless, and needs no consent banner —
enable it from the dashboard if you want readership numbers. Do **not** add Google
Analytics: it would drag a cookie-consent obligation onto a site that otherwise has
no privacy surface at all, which is one of your publication's genuine assets.

## Failure signatures

| Symptom | Cause | Fix |
|---|---|---|
| Green build, site unchanged | Build/deploy commands swapped | Fix the two slots; confirm Active deployment matches your commit |
| `522` on a custom domain | Hostname never added under the Worker's **Domains** tab | Add it there — never hand-create the DNS record |
| Domain won't resolve after nameserver change | DNSSEC DS records left at the registrar, or registrar nameservers mixed with Cloudflare's | Clear DS records; replace ALL nameservers, never mix sets |
| Redirect loop | SSL/TLS mode set to Flexible | Set **Full (strict)** |
| Old site after a good deploy | Your browser's cache | Hard-reload; the edge was right, the browser wasn't |

Custom domains are entirely optional and covered in `docs/CUSTOM-DOMAIN.md`.
