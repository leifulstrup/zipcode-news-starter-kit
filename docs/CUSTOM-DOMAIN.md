# Custom domain (optional)

Your site already works at `<workerName>.<account>.workers.dev`, free, forever.
A custom domain — `12345.news`, `mytownweekly.com` — is a readability and trust
upgrade, not a requirement. Budget roughly $10–50/year depending on the TLD
(`.news` runs higher than `.com`).

## Buy

Any registrar works (Cloudflare Registrar keeps everything in one place; name.com,
Namecheap, Porkbun are all fine). You are buying only the name — no hosting, no
email, no add-ons.

## Point it at Cloudflare

1. In the Cloudflare dashboard, **Add a site** → your domain → Free plan. Cloudflare
   shows you two nameservers.
2. At your registrar, replace **all** of the registrar's nameservers with the two
   Cloudflare ones. **All, never mixed** — leaving one registrar nameserver in place
   causes intermittent resolution failures that are miserable to diagnose.
3. If the registrar had **DNSSEC** enabled, clear its DS records **before** the
   nameserver change, or the domain will not resolve at all.

## Attach it to the Worker

In the Worker's settings → **Domains** tab, add `yourdomain` and `www.yourdomain`.
This creates the DNS records automatically — **never hand-create them**; a
hand-made record pointing at the deployment without the hostname registered on the
Worker is the classic `522`.

Set SSL/TLS mode to **Full (strict)**. (Flexible causes a redirect loop.)

## Tell the kit

1. `site.config.json` → `"domain": "yourdomain"` — this switches the canonical
   URLs, the RSS feed's self-link, and the sitemap to the new name.
2. Add the domain to `config/sources.json` → `self`.
3. `gh variable set SITE_BASE_URL --body "https://yourdomain"` so the smoke tests
   watch the real front door.
4. Commit and push; the next deploy serves the new name. The workers.dev URL keeps
   working as a fallback.
