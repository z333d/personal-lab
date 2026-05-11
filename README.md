# create-pages-site-template

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

## Bootstrapping a new lab

```bash
git clone git@github.com:z333d/create-pages-site-template.git
cd create-pages-site-template
pnpm install
npx wrangler login                       # interactive
node scripts/setup.mjs                   # one-time per-user config

node scripts/create-lab.mjs <lab-name>   # all-in-one:
#   • copies template → ../<lab-name>/
#   • creates the GitHub repo + first commit + push
#   • creates per-app D1 + runs migrations
#   • deploys every Worker + sets BETTER_AUTH_SECRET / BETTER_AUTH_URL
#   • prints the live URL
```

Optional flags: `--no-deploy` (skip Cloudflare), `--no-domain` (use *.workers.dev), `--domain my.example.com`, `--keep-on-fail` (don't roll back on errors), `--org <github-owner>`.

Inside a generated lab, `pnpm scaffold page|app <slug> [--fullstack]` adds new content. `pnpm build && pnpm deploy:all` redeploys everything.

---

## Documentation

- **[AGENTS.md](./AGENTS.md)** — operating manual for any AI agent (or human) working *inside* a generated lab. Conventions, brand workflow, traps, troubleshooting. Symlinked as `CLAUDE.md` for Claude Code.
- **[HANDOFF.md](./HANDOFF.md)** — catch-up doc for continuing work *on this template repo itself*. Current status, pending items, known traps, where state lives.
- **[GRADUATION.md](./GRADUATION.md)** — how to extract a lab app into its own repo when it outgrows the lab.
- **[`design-samples/`](./design-samples/)** — three reference DESIGN.md variants (Notebook, Terminal, Postcard) to give the agent + user concrete options when picking a brand.

---

## Showcase

The two apps under `apps/` are deliberate examples of what's possible, not the official lab style:

- **`apps/todo/`** — Notebook theme, fullstack (Hono + D1 + Better Auth).
- **`apps/counter/`** — Terminal theme, static.

Sibling apps' brands should never be inherited silently — each new app gets its own register via its own `DESIGN.md`. The auto-generated lab landing page is intentionally neutral (system fonts, no chroma) because the lab itself is the table of contents, not a brand.

---

## Why a template and not a starter generator

A template is just a folder you clone. Everything is visible, everything is editable, and there is no "generate-then-eject" cliff. The Claude Code skill `create-pages-site` wraps the `create-lab.mjs` flow with a conversational interface, but the template stands on its own — anyone (or any agent) with a Cloudflare account and a GitHub account can run the scripts directly.
