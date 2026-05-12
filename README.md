# personal-lab

**English** · [简体中文](./README.zh-CN.md)

A template for **personal "labs"** that host a flat directory of HTML pages, static React apps, and full-stack React+D1 apps under a single Cloudflare Workers domain.

One repo, one Cloudflare account, one subdomain. Add a new page or app by writing one file or one folder — no infra fiddling. Cheap to add, cheap to delete, cheap to graduate when something outgrows the lab.

---

## What goes in a lab

| Kind | Where | URL | Backed by |
|---|---|---|---|
| HTML page | `pages/<slug>.html` | `/<slug>.html` or `/pages/<slug>.html` | root Worker |
| Static React app | `apps/<slug>/` | `/apps/<slug>/` | root Worker |
| Full-stack app (login + DB) | `apps/<slug>/` with `lab.fullstack: true` | `/apps/<slug>/*` | own Worker, own D1, own Better Auth realm |

All URLs sit under one host. Dispatch to fullstack Workers is via Cloudflare Workers Routes (custom domain) or Service Bindings (workers.dev), transparently to the apps themselves.

Stack per fullstack app: Vite + React 19, Hono on Workers, Drizzle on D1, Better Auth (with a custom PBKDF2 hash that fits inside the free-tier 10 ms CPU limit), Tailwind v4 + shadcn primitives consuming brand tokens from each app's own `DESIGN.md`.

---

## Prerequisites

What you need before starting (covers all your labs, not just this template):

- A **GitHub account** (free tier OK).
- A **Cloudflare account** (free tier OK — 100 Workers + 10 D1 databases per account is plenty for a personal lab).
- *Optional:* a domain managed by Cloudflare DNS if you want labs at `<lab>.<your-domain>` instead of `<lab>.<account>.workers.dev`.

CLI tools (macOS install commands shown — Linux/Windows equivalents work too):

| Tool | Install | Authenticate |
|---|---|---|
| Node 20+ | `brew install node` (or use `nvm` / `fnm`) | — |
| pnpm 10+ | `corepack enable pnpm` (built into Node 22+) | — |
| gh CLI | `brew install gh` | `gh auth login` (choose SSH) |
| wrangler | bundled — installed by `pnpm install` in the next step | `npx wrangler login` (interactive browser flow) |

*Optional but recommended:* grant the `delete_repo` scope so you can delete experimental labs from the CLI later — the default `gh auth login` doesn't include it.

```bash
gh auth refresh -h github.com -s delete_repo
```

Sanity-check before continuing:

```bash
node --version       # v20 or later
pnpm --version       # 10 or later
gh auth status       # "Logged in to github.com account <you>"
npx wrangler whoami  # "You are logged in with … associated with the email …"
```

---

## Setup (one-time per user)

Clone this template and run the setup wizard. The template can stay on disk forever — you only clone it once, and each lab you create from it lives in its own directory.

```bash
git clone git@github.com:z333d/personal-lab.git
cd personal-lab
pnpm install
node scripts/setup.mjs       # writes ~/.config/personal-lab/config.json
```

`setup.mjs` asks three things, each with a sensible default:

1. **GitHub owner** for new lab repos (defaults to your `gh` login).
2. **URL pattern** for labs — either `<lab>.<your-domain>` (requires a Cloudflare-managed zone) or `<lab>.<account>.workers.dev`.
3. **Where to put new labs on disk** — e.g. `~/projects/playground`.

---

## Create a lab

```bash
node scripts/create-lab.mjs <lab-name>   # ~2 minutes end-to-end
```

Does everything in one go:

- Copies the template → `<projects-dir>/<lab-name>/`
- Creates the GitHub repo + first commit + push
- Creates per-app D1 + runs migrations
- Deploys every Worker + sets `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`
- Prints the live URL

Flags: `--no-deploy` (skip Cloudflare), `--no-domain` (force *.workers.dev), `--domain my.example.com` (override the configured zone for this lab), `--keep-on-fail` (don't roll back on errors — useful for debugging), `--org <github-owner>` (override the configured GitHub owner).

---

## Day-to-day usage

You're now in `<projects-dir>/<lab-name>/` with a live deployment. Adding content is local then `git push` (or `pnpm deploy:*`).

**Add an HTML page** — ~30 seconds

```bash
pnpm scaffold page <slug>
# edit pages/<slug>.html — single file, inline <style> and <script>, no build step
pnpm deploy:root
# live at /pages/<slug>.html (and /<slug>.html)
```

**Add a static React app** — ~2 minutes

```bash
pnpm scaffold app <slug>
# writes apps/<slug>/ with a neutral DESIGN.md + App.tsx placeholder
# before building UI, pick a register from design-patterns.md, rewrite
# DESIGN.md, then `pnpm theme:gen` and edit src/App.tsx
pnpm build && pnpm deploy:root
# live at /apps/<slug>/
```

**Add a full-stack app** — ~10 minutes (the one path that needs manual Cloudflare steps)

```bash
pnpm scaffold app <slug> --fullstack

# 1. provision D1
npx wrangler d1 create <lab-name>-<slug>
# paste the returned database_id into apps/<slug>/wrangler.jsonc

# 2. apply the auth-only initial migration
cd apps/<slug>
npx wrangler d1 execute <lab-name>-<slug> --remote --file drizzle/migrations/0000_init.sql

# 3. set the two secrets
echo -n "$(openssl rand -base64 36)" | npx wrangler secret put BETTER_AUTH_SECRET
echo -n "https://<lab-name>.<your-domain>" | npx wrangler secret put BETTER_AUTH_URL

# 4. deploy
cd ../..
pnpm build && pnpm deploy:all
# live at /apps/<slug>/
```

**Local development**

```bash
pnpm dev                          # everything: root Worker + every fullstack app
pnpm --filter @lab/<slug> dev     # just one app
```

**Re-deploy**

```bash
pnpm deploy:root                  # root Worker only (pages + static apps + landing)
pnpm deploy:all                   # everything (root + each fullstack Worker)
```

`design-patterns.md` is the shared aesthetic vocabulary — consult it before writing UI for a new app so you (or your agent) don't default to the bland AI-SaaS look.

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — operating manual for any AI agent (or human) working *inside* a generated lab. Conventions, brand workflow, traps, troubleshooting. Symlinked as `CLAUDE.md` for Claude Code.
- **[HANDOFF.md](./HANDOFF.md)** — catch-up doc for continuing work *on this template repo itself*. Current status, pending items, known traps, where state lives.
- **[GRADUATION.md](./GRADUATION.md)** — how to extract a lab app into its own repo when it outgrows the lab.
- **[design-patterns.md](./design-patterns.md)** — a shared aesthetic vocabulary (seven named registers from Essay to Manifesto) for the agent and user to point at when picking a brand for a new app.

---

## Built-in examples

- **`apps/todo/`** — fullstack app, Notebook register (warm cream, serif, quiet personal tool).
- **`apps/counter/`** — static app, Terminal register (monospace, dark, dense).
- **`pages/welcome.html`** — sample HTML page.

These are the working references both the agent and you can read when in doubt.

---

## Why a template and not a starter generator

A template is just a folder you clone. Everything is visible, everything is editable, and there is no "generate-then-eject" cliff. The Claude Code skill `create-pages-site` wraps the `create-lab.mjs` flow with a conversational interface, but the template stands on its own — anyone (or any agent) with a Cloudflare account and a GitHub account can run the scripts directly.
