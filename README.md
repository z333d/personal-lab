# personal-lab

**English** · [简体中文](./README.zh-CN.md)

A template for **personal "labs"** — each lab hosts a flat directory of HTML pages, static React apps, and full-stack React+D1 apps under a single Cloudflare Workers domain.

You clone this template **once** and keep it on disk. From there, `node scripts/create-lab.mjs <name>` produces an **independent lab** (its own GitHub repo, its own Cloudflare Worker, its own subdomain). Make as many labs as you want — `personal-blog`, `internal-tools`, `gift-for-a-friend`. Each is a self-contained universe; the only shared things are your Cloudflare account quota and your GitHub org.

Inside a lab, adding a new page or app is one file or one folder — no infra fiddling. Cheap to add, cheap to delete, cheap to graduate when something outgrows its lab.

---

## What goes in a lab

| Kind | Where | URL | Backed by |
|---|---|---|---|
| HTML page | `pages/<slug>.html` | `/<slug>.html` or `/pages/<slug>.html` | shared root Worker |
| Static React app | `apps/<slug>/` | `/apps/<slug>/` | shared root Worker |
| Full-stack app (with login + database) | `apps/<slug>/` with `lab.fullstack: true` | `/apps/<slug>/*` | own Worker + own SQLite database + own login realm |

All URLs sit under one host. Dispatch to per-app Workers is transparent to the apps themselves (Cloudflare Workers Routes on custom domains, Service Bindings on workers.dev).

**Stack per fullstack app**: Vite + React 19 (frontend), Hono on Cloudflare Workers (backend), [Drizzle](https://orm.drizzle.team/) ORM on Cloudflare D1 (a serverless SQLite database), [Better Auth](https://www.better-auth.com/) for sign-up / sign-in / sessions (with a custom PBKDF2 hash that fits inside the Workers free-tier 10 ms CPU limit), Tailwind v4 + shadcn primitives reading brand tokens from each app's own `DESIGN.md`.

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
2. **URL pattern** for labs — either `<lab>.<your-domain>` (requires a Cloudflare-managed DNS zone) or `<lab>.<account>.workers.dev`. The `<account>` part is the Workers subdomain configured for your Cloudflare account (visible at `dash.cloudflare.com → Workers & Pages → Subdomain`; defaults to your account's name).
3. **Where to put new labs on disk** — e.g. `~/projects/playground`.

> ⚠️ **The template itself is not directly runnable.** Files like `apps/todo/wrangler.jsonc` contain placeholder strings (`__LAB_NAME__`, `__APP_TODO_ROUTES__`, …) that only get filled in when `create-lab.mjs` produces a real lab. Don't try to `pnpm dev` or `pnpm build` from inside this cloned template — run those commands inside a generated lab (the next step's output tells you where it landed).

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

**Add a full-stack app** — one command end-to-end with `--deploy`

```bash
pnpm scaffold app <slug> --fullstack --deploy
# scaffold + D1 create + migration + secrets + .dev.vars + build + deploy
# live at /apps/<slug>/ when the command returns. Idempotent on rerun.
```

If you'd rather do each step yourself (to inspect intermediate state, or because you don't want the scaffold to provision Cloudflare resources for you):

```bash
pnpm scaffold app <slug> --fullstack       # without --deploy

# 1. provision D1
npx wrangler d1 create <lab-name>-<slug>
# paste the returned database_id into apps/<slug>/wrangler.jsonc

# 2. apply the auth-only initial migration
cd apps/<slug>
pnpm db:migrate:remote

# 3. set the two production secrets
echo -n "$(openssl rand -base64 36)" | npx wrangler secret put BETTER_AUTH_SECRET
echo -n "https://<lab-name>.<your-domain>" | npx wrangler secret put BETTER_AUTH_URL

# 4. (optional) set up .dev.vars so `pnpm dev` works locally
cp .dev.vars.example .dev.vars
# edit .dev.vars and paste any random BETTER_AUTH_SECRET; the
# BETTER_AUTH_URL=http://localhost:8787 default is fine

# 5. deploy
cd ../..
pnpm build && pnpm deploy:all
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

Or, once you've added a `CLOUDFLARE_API_TOKEN` secret to the repo (Settings → Secrets and variables → Actions), `.github/workflows/deploy.yml` runs `pnpm deploy:all` automatically on every push to `main` and on manual dispatch. New fullstack apps still need their first `--deploy` from a local machine (to provision D1 and set secrets); CI only handles subsequent redeploys.

**Remove a page or app**

```bash
pnpm scaffold rm <slug>           # auto-detects kind, prompts before CF deletes
pnpm scaffold rm <slug> --yes     # skip the prompt
```

Removes the local files, the Cloudflare Worker + D1 (for fullstack), and rebuilds + redeploys the root Worker so the service binding / asset goes away. D1 deletion is irreversible — back up first if the data matters.

**Add an R2 bucket** (for large images / fonts / videos that shouldn't live in git)

```bash
pnpm scaffold r2 <bucket>
# creates Cloudflare R2 bucket `<lab>-<bucket>`, prints the binding block
# to paste into any app's wrangler.jsonc that needs it
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

A fresh lab ships with two showcase apps and six HTML pages — one per [design pattern](./design-patterns.md) — so the very first thing you see on the landing is "this is what your lab could look like":

- **`apps/todo/`** — fullstack app, **Notebook** register (warm cream, serif, quiet personal tool).
- **`apps/counter/`** — static app, **Terminal** register (monospace, dark, dense).
- **`pages/essay.html`** — **Essay** register (single column, paper serif, long-form reading).
- **`pages/sketchnote.html`** — **Sketchnote** register (handmade, washi tape, marginalia).
- **`pages/postcard.html`** — **Postcard** register (centered card, ornamental, special-occasion).
- **`pages/manifesto.html`** — **Manifesto** register (full-bleed color blocks, condensed display, one thesis per screen).
- **`pages/playful.html`** — **Neo-Memphis Playful** register (cream + saturated panels + tape/stickers).
- **`pages/welcome.html`** — short Notebook-flavored hello page.

The six pages are tagged on the landing as *starter examples*. Delete the ones you don't want:

```bash
pnpm scaffold rm essay
pnpm scaffold rm sketchnote
# etc.
```

---

## Troubleshooting (setup time)

These are the snags people actually hit during the bootstrap. In-lab errors (404s on `/apps/foo/`, auth failures, missing service bindings, etc.) are documented in [AGENTS.md](./AGENTS.md#common-errors-and-fixes) instead.

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm install` warns "build scripts ignored: esbuild, sharp, workerd" | pnpm 10 blocks postinstall scripts by default | The workspace already allowlists these via `pnpm.onlyBuiltDependencies`. If you see the warning anyway, you're on a fork that hasn't synced — copy the `pnpm` block in `package.json` from upstream. |
| `node scripts/setup.mjs` hangs on the second question when stdin is piped | known readline quirk with non-TTY input | Already worked around (pipe mode reads stdin upfront). If you forked before May 2026 sync the patch. |
| `create-lab.mjs` fails at "Create D1 database" with `Expected "routes" to be an array but got null` | wrangler 4 rejects `"routes": null` | Sync from upstream — earlier versions emitted `null`; current version emits `[]`. |
| `create-lab.mjs` fails at "Create D1 database" with `"zone_name": null` | `--domain my-lab.example.com` was passed but `setup.mjs` config has `defaultZone: null` | Sync from upstream — the zone is now derived from the `--domain` when config is missing. |
| `gh repo create` fails with `403` / `permissions` | `gh auth login` didn't request `repo` scope (rare) or `delete_repo` is missing | `gh auth refresh -h github.com -s repo` (or `-s delete_repo` if cleanup is what's failing). |
| `wrangler login` doesn't open a browser | outdated wrangler | `pnpm install` pulls wrangler 4.x — try again inside the project dir. |
| `pnpm dev` / `pnpm build` in this template directory errors about placeholders (`__LAB_NAME__`, `__APP_TODO_ROUTES__`) | you're running scripts in the *template* clone, not a generated lab | The template is not directly runnable. Run `node scripts/create-lab.mjs <name>` first, then `cd` into the generated lab. |
| `wrangler whoami` says "not authenticated" right after `wrangler login` succeeded | wrangler stores the token under the parent process's HOME; `pnpm install` may have run with a different HOME (rare on macOS) | Run `npx wrangler login` again from the project directory specifically. |

---

## Why a template and not a starter generator

A template is just a folder you clone. Everything is visible, everything is editable, and there is no "generate-then-eject" cliff. A companion Claude Code skill (`create-personal-lab`) is planned that wraps the `create-lab.mjs` flow with a conversational interface, but the template stands on its own — anyone (or any agent) with a Cloudflare account and a GitHub account can run the scripts directly.
