# AGENTS.md

This is a **lab repo** — a multi-app workspace deployed across a small fleet of Cloudflare Workers under a single domain. Pages, static React apps, and full-stack apps live side by side. Adding new content is a one-file or one-folder operation; you (an agent or a human) never need to touch infrastructure.

This document tells you how to operate inside this repo. Any AI coding agent — Claude Code, Cursor, OpenCode, Gemini CLI, Codex, etc. — should follow these rules.

## What you can build

| Kind | Where it lives | URL | Backed by |
|---|---|---|---|
| HTML page | `pages/<slug>.html` | `/<slug>.html` *and* `/pages/<slug>.html` | root Worker |
| Static React app | `apps/<slug>/` (no `db.ts`) | `/apps/<slug>/` | root Worker |
| Full-stack app (login + DB) | `apps/<slug>/` (own `wrangler.jsonc` + framework) | `/apps/<slug>/*` | own Worker |

All URLs sit under one lab domain (`https://<lab>.<your-domain>` or `https://<lab>.<account>.workers.dev`). Path-prefix dispatch happens two ways, transparently to apps:

- **With a custom domain**, Cloudflare Workers Routes (declared in each fullstack app's `wrangler.jsonc`) intercept `<lab>/apps/<slug>/*` before the request hits the root Worker.
- **Without** (on workers.dev), the root Worker uses **Service Bindings** to dispatch `/apps/<slug>/*` to the per-app Worker. `scripts/build-lab.mjs` injects these bindings into `server/wrangler.generated.jsonc` based on which fullstack apps it discovers, and the root Worker requires `assets.run_worker_first: true` so Worker code runs before the Static Assets SPA fallback (otherwise HTML navigations would 200 the lab landing for any unbound path).

## Decision: which kind do I build?

When the user asks for "做个页面 / a page" → **HTML page**.
When the user asks for "做个应用 / app / 小工具" with no mention of saving data, login, or other users → **static React app**.
When the user mentions login, accounts, sign up, database, "save to my account", or "see other users" → **full-stack app**.

If unsure, start with HTML or static. Upgrading later is a copy-folder, but going simpler is easier than going more complex.

---

## Adding an HTML page

Drop one file at `pages/<slug>.html`.

```
pages/
└── my-thing.html
```

After `git push`, it's live at `/pages/my-thing.html`.

**Conventions**
- `<slug>` is lowercase, kebab-case (`apple-watch-guide` ✓, `AppleWatch` ✗).
- Self-contained: inline `<style>` and `<script>` for small things. Larger assets go in `pages/<slug>-assets/` and reference with relative paths.
- No build step. The file you write is the file that ships.
- For images / videos / large data: see "Static assets" below.

## Adding a static React app

```bash
pnpm scaffold app <slug>
```

(Equivalent to copying `apps/_template-static/` to `apps/<slug>/`.)

```
apps/<slug>/
├── package.json       # name: "<lab>/<slug>"
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    └── App.tsx
```

Edit `src/` like any Vite + React app. After `git push`, live at `/apps/<slug>/`. Bundled and served by the root Worker as static assets — no per-app Worker needed.

**Conventions**
- `package.json.name` must be `<lab>/<slug>` so workspaces wire correctly.
- `vite.config.ts` must read `LAB_APP_BASE` env var for `base`. The build script sets it.
- No backend. State stays in the browser (`useState`, `localStorage`, IndexedDB).
- Want to call an API? It's a full-stack app, not a static one. Switch templates.

## Adding a full-stack app

```bash
pnpm scaffold app <slug> --fullstack --deploy
```

A full-stack app is a **complete child project** with its own `wrangler.jsonc` and its own Worker on deploy. The scaffolder copies from `apps/todo/` (Hono + Vite + React) and neutralizes the brand + business code so you start from a clean auth-only template. Other frameworks (TanStack Start, Astro) are *not* wired in yet — only `hono-vite` works today.

Drop `--deploy` if you want to inspect intermediate state (the scaffold then leaves the Cloudflare side to you — see "Lifecycle" below for the four manual steps).

The lab's build script wires the new app into the root Worker's path routing via service bindings once you provision its D1 (see "Lifecycle" below).

```
apps/<slug>/
├── wrangler.jsonc       # this app's Worker config (D1 binding, secrets)
├── package.json         # standard package.json + "lab.fullstack": true
├── tsconfig.json
├── drizzle/
│   └── migrations/      # auth-only 0000_init.sql out of the box
├── shared/
│   └── schema.ts        # Drizzle schema; export `schema`
└── src/
    ├── client/          # Vite + React SPA (main.tsx, App.tsx)
    └── server/          # Hono router (mounts /apps/<slug>/api/*)
```

### Lifecycle for a brand-new fullstack app

**The easy path** — `pnpm scaffold app <slug> --fullstack --deploy` does everything in one command: scaffolds the folder, provisions a new D1, applies the auth-only initial migration, sets BETTER_AUTH_SECRET / BETTER_AUTH_URL on Cloudflare, writes a local `.dev.vars` with a *separate* dev secret, then `pnpm build && pnpm deploy:all`. Re-running is safe (D1 lookups + migration applies + secret puts are all idempotent). Use this unless you specifically need to inspect intermediate state.

To remove an app or page later, `pnpm scaffold rm <slug>` auto-detects what kind it is and tears down the right things: a page is just an `unlink`, a static app is `rm -rf`, a fullstack app additionally deletes its Worker and D1 database. The command prompts before destructive Cloudflare ops; pass `--yes` to skip the prompt. It rebuilds + redeploys the root Worker at the end so the service binding (if any) and the static asset both disappear from production in one step.

**The manual path** — `pnpm scaffold app <slug> --fullstack` writes the folder + pnpm-installs, but does **not** touch Cloudflare. Before the new app can be reached, you (or the agent) must:

```bash
# 1. provision its D1 (the scaffold leaves a __D1_<SLUG>_ID__ placeholder)
npx wrangler d1 create <lab>-<slug>
#    → paste the returned database_id into apps/<slug>/wrangler.jsonc

# 2. apply the auth-only initial migration
cd apps/<slug>
pnpm db:migrate:remote
# (equivalent to `npx wrangler d1 migrations apply DB --remote` —
# `wrangler d1 migrations apply` tracks applied migrations in a
# d1_migrations table inside the database, so re-running is safe and
# subsequent `pnpm db:generate` + `pnpm deploy:all` will pick up new
# migrations automatically.)

# 3. set the per-app secrets
echo -n "$(openssl rand -base64 36)" | npx wrangler secret put BETTER_AUTH_SECRET
echo -n "https://<lab>.<your-domain-or-workers.dev>" | npx wrangler secret put BETTER_AUTH_URL

# 4. (optional) set up local-dev secrets so `pnpm dev` can auth
cp .dev.vars.example .dev.vars
# edit the new .dev.vars: paste a random BETTER_AUTH_SECRET
# (e.g. `openssl rand -base64 36`); BETTER_AUTH_URL=http://localhost:8787 is fine

# 5. deploy
cd ../..
pnpm build && pnpm deploy:all
```

`pnpm deploy:all` refuses to deploy a fullstack app whose `wrangler.jsonc` still contains the D1 placeholder, so step 1 must be done first. `pnpm build` excludes "pending" apps (placeholder D1) from service bindings + landing automatically — so re-running `pnpm deploy:root` after a scaffold (without provisioning D1) is safe and just leaves the new app dark.

Step 4 (`.dev.vars`) is only needed when you want to run the app locally via `pnpm dev` (or `wrangler dev` inside the app folder). Without it, `wrangler dev` boots fine but Better Auth fails because `BETTER_AUTH_SECRET` is undefined. `.dev.vars` is `.gitignore`d; only `.dev.vars.example` is tracked.

The original `apps/todo/` and `apps/counter/` showcase apps are wired by `scripts/create-lab.mjs` at lab-creation time — those steps run once and you never need to repeat them for the initial pair.

### Hono + Vite (the current fullstack template)

- Hono router is mounted at the app's root (`/apps/<slug>/api/*`).
- React SPA built and served as static assets via Workers Static Assets binding.
- Better Auth handler is automatically composed into the Hono router at `api/auth/*`.

### What `shared/schema.ts` must export

The scaffolded `shared/schema.ts` is auth-only:

```ts
import { authSchema } from '@lab/lib/auth-schema';
export const { user, session, account, verification } = authSchema;
export const schema = { user, session, account, verification };  // REQUIRED name
```

When you add business tables, append them and re-export — then run `pnpm db:generate` inside the app to produce a new migration:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { authSchema } from '@lab/lib/auth-schema';

export const { user, session, account, verification } = authSchema;

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
});

export const schema = { user, session, account, verification, todos };
```

### What the auth helper looks like

```ts
// In any framework, somewhere in server code:
import { createAppAuth, getDb } from '@lab/lib';
import { schema } from '../../shared/schema';

const auth = createAppAuth(env, schema);     // env from your framework's request handler
const db = getDb(env, schema);

const user = await auth.api.getSession({ headers });
```

`@lab/lib` is a workspace package at the lab root that you don't have to install — it's already wired via `pnpm` workspaces.

---

## Brand and DESIGN.md (per-app)

Each app under `apps/<slug>/` carries its own brand via `apps/<slug>/DESIGN.md`. The lab itself has no brand — the auto-generated `/` (lab index) is intentionally a neutral system-flavored directory listing. Sibling apps' brands are concrete examples, not defaults.

**Rule of thumb**: each app gets its own register. Notebook (todo) and Terminal (counter) are showcases of *what's possible*, not the official lab style. If a new app silently inherits the vibe of a sibling app, you've made a mistake.

### Workflow when building or significantly changing UI

1. **Ask first** — before writing components or CSS for a new app (or a major redesign of an existing one):
   - Confirm **what the app does** (one sentence).
   - Consult [`design-patterns.md`](./design-patterns.md) for the shared aesthetic vocabulary (seven named patterns: Essay · Sketchnote · Postcard · Notebook · Terminal · Manifesto · Neo-Memphis Playful), short-list the 2–3 that fit, and have the user pick one — or invoke `/design-shotgun` to generate visual variants and let them choose by sight.
   - Do **not** default to "soft minimal SaaS" — that's the AI baseline `design-patterns.md` exists to push away from.
2. **Rewrite `apps/<slug>/DESIGN.md`** to match the chosen pattern's visual fingerprint — colors (with hint of chroma, never pure gray), typography, radii, plus a Markdown paragraph naming the pattern and explaining *why this brand for this product*. Deviations from the pattern's defaults should be conscious and noted.
3. **Run `pnpm --filter @lab/<slug> theme:gen`** to regenerate `theme.generated.css`.
4. **Build components** that consume brand tokens (`bg-accent`, `text-fg`, `border-border`, etc.) — never hard-code colors in JSX.
5. When done, run a quick `/impeccable critique` against the result if the surface is more than throwaway.

### What scaffold gives you

`pnpm scaffold app <slug>` (with or without `--fullstack`) writes a **neutral placeholder** for both `DESIGN.md` and the entry `App.tsx`. The placeholder uses pure system styling (white surface, near-black text, light gray borders, generic blue accent). It is intentionally bland — that's the signal "fill me in."

Do not ship the placeholder to users. Treat it as a forcing function: before any non-trivial UI work, you must rewrite `DESIGN.md` and replace the placeholder `App.tsx`.

### The spacing trap (don't repeat history)

The tool that exports `DESIGN.md` → Tailwind v4 `@theme` (`scripts/gen-theme.mjs` inside each app) **must not** emit `--spacing-xs / --spacing-sm / --spacing-xl / ...`. Tailwind v4 reads that namespace and overrides `max-w-md / max-w-xl / py-4 / gap-2` etc. — which silently destroys layouts (content gets compressed to ~24px wide with no console error).

`DESIGN.md`'s `spacing` block is **documentation only** ("lg ≈ 16px"). Use Tailwind's built-in numeric scale (`gap-4`, `py-6`) in components. If you need a named space, reference `--space-*` (which the generator does emit, in a non-conflicting namespace).

`color`, `radius`, `font`, etc. are safe to emit because Tailwind v4 *intends* for `DESIGN.md` to take over those namespaces.

### The text-* collision (cn.ts must extend tailwind-merge)

`DESIGN.md` emits two namespaces that both produce `text-*` Tailwind utilities:

- `--text-display / --text-h1 / --text-body / --text-body-sm / --text-caption` → font-size classes (`text-body` etc.)
- `--color-fg / --color-primary-on / --color-accent / ...` → text-color classes (`text-fg`, `text-primary-on`, etc.)

Stock `tailwind-merge` (used by `cn()`) buckets every `text-*` class as one conflict group, so `cn('bg-primary text-primary-on text-body')` silently drops the color class — leaving buttons with invisible text on solid backgrounds. The fix is in `apps/<slug>/src/lib/cn.ts` (or `src/client/lib/cn.ts` for fullstack), which uses `extendTailwindMerge` to register both groups separately. Don't replace it with the stock `twMerge` shorthand — that re-introduces the bug.

If you add a new color or font-size token to `DESIGN.md`, also add it to the `FONT_SIZE_TOKENS` / `TEXT_COLOR_TOKENS` arrays in `cn.ts` so tailwind-merge knows about it.

### HTML pages (not React) are different

A `pages/<slug>.html` is a single self-contained file with no build pipeline — it can't import `theme.generated.css`. So an HTML page either:
- (a) Stays brand-neutral with inline system styling (the default the scaffolder writes), or
- (b) Inlines its own brand via a `<style>` block. In that case, the page can carry whatever vibe fits the content; you don't have to match any sibling app or the lab index.

`pages/welcome.html` plus `essay.html` / `sketchnote.html` / `postcard.html` / `manifesto.html` / `playful.html` are starter examples that ship with a fresh lab — one HTML page per design register from [`design-patterns.md`](./design-patterns.md). Each is tagged on the landing with a `starter example` badge so the user knows they're safe to `pnpm scaffold rm` once they don't want them. The tagging convention is an HTML comment near the top of the file:

```html
<!doctype html>
<!-- lab-example -->
<html ...>
```

`scripts/build-lab.mjs` greps for that comment during `discoverPages()` and renders the badge.

---

## Static assets (images, fonts, videos)

| Where | When | URL |
|---|---|---|
| `pages/<slug>-assets/` or `apps/<slug>/public/` | Small (< 1 MB), version with code | shipped via Workers Static Assets, free, automatic |
| Cloudflare R2 bucket | Large (> 1 MB), or many of them | `https://<bucket>.r2.dev/...`; not in git |

Provision a bucket from the lab root:

```bash
pnpm scaffold r2 <bucket>
# wrangler creates `<lab>-<bucket>` and prints the binding block to paste
# into a fullstack app's wrangler.jsonc.
```

The scaffold deliberately does *not* edit any app's wrangler.jsonc — one bucket may be bound by multiple apps, or used purely as a public r2.dev origin without a binding at all. Decide which apps need the binding, paste the printed block into each. To make assets publicly readable without a binding, enable Public access on the bucket in the Cloudflare dashboard and reference the r2.dev URL directly.

---

## Conventions you must follow

0. **Brand**: each app owns its own `DESIGN.md`. Never copy a brand from a sibling app without the user asking for it. See "Brand and DESIGN.md" above for the full workflow.
1. **Slugs** are lowercase kebab-case, 3–40 chars, must start with a letter.
2. **Don't** add new top-level directories. Only `pages/`, `apps/`, `lib/`, `scripts/`, `.github/` are expected.
3. **Don't** edit the lab's root `server/wrangler.jsonc` directly unless you know what you're doing — it's the *template*; the deployed config lives at `server/wrangler.generated.jsonc` and is rewritten on every `pnpm build`. Manual edits to the template should not introduce `__PLACEHOLDER__` patterns (the build script aborts on stray placeholders).
4. **Per-app `wrangler.jsonc` is yours to read** but most edits should be done by the skill. If you must edit, mark it with a `// MANUAL:` comment so the build script preserves it.
5. **Don't** create migration files in `drizzle/` directories by hand — Drizzle generates them from `schema.ts`.
6. **Don't** put secrets in code or in committed `.env` files. Lab secrets are managed by `wrangler secret`. If you need a new secret, document it and have the lab owner set it.
7. **Don't** call across apps directly. Each full-stack app is a self-contained product with its own DB and auth realm. Sharing happens through code (`@lab/lib`) or through publishing a public API.
8. **Do** export `schema` (object) from any `shared/schema.ts` — the build script looks for this exact name.
9. **Do** keep apps small. If an app grows past significant scope, consider graduating it to its own repo (see `GRADUATION.md`).

## Things that are auto-managed (don't fight them)

- `server/wrangler.generated.jsonc` (rewritten by build-lab.mjs; this is the file `wrangler deploy` reads)
- Per-app `wrangler.jsonc` — initial generation by create-lab.mjs (placeholders for D1 id, routes). Subsequent edits via the skill or marked `// MANUAL:`
- `dist/` — build output for the root Worker's static assets
- Service Bindings injected into root config based on which fullstack apps have a real (non-placeholder) D1 id
- Cloudflare Workers Routes (only when a custom domain is configured)
- Better Auth secrets per app (auto-generated by create-lab.mjs; manual via `wrangler secret put` for apps added after lab creation)

If you find yourself wanting to edit any of these, stop and re-read this doc. There's almost certainly a convention you're missing.

---

## Local development

```bash
pnpm install                    # one-time
pnpm dev                        # everything: root Worker + each fullstack app concurrently
pnpm dev <slug>                 # focus on one app (faster startup, smaller log volume)
pnpm db:migrate <slug>          # run migrations against this app's local D1
pnpm db:studio <slug>           # open Drizzle Studio
```

## Deployment

```bash
pnpm build         # scripts/build-lab.mjs: discover content, build each app,
                   # write server/wrangler.generated.jsonc with service bindings
pnpm deploy:all    # scripts/deploy-all.mjs: deploy fullstack Workers first
                   # (so root's service bindings target real services), then root
```

`pnpm deploy:root` alone redeploys just the root Worker — useful after editing pages or static apps.

`.github/workflows/deploy.yml` runs the same `pnpm build && pnpm deploy:all` automatically on every push to `main` (and on manual dispatch). Required setup: add a `CLOUDFLARE_API_TOKEN` repo secret with `Workers Scripts Edit` + `D1 Edit` + `R2 Storage Edit` permissions. See https://developers.cloudflare.com/workers/wrangler/ci-cd/. D1 provisioning is *not* automatic in CI — new fullstack apps still need a one-time `pnpm scaffold app <slug> --fullstack --deploy` from the lab owner's machine (or the manual lifecycle steps).

---

## Common errors and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| `/apps/foo/` shows the lab landing in a browser but the right thing in curl | `assets.run_worker_first: true` missing from `server/wrangler.jsonc` (Static Assets answers HTML navigations before Worker code) | Restore the flag and `pnpm deploy:root` |
| `/apps/foo/` 404 (no service binding) | Fullstack app's D1 still has the `__D1_<SLUG>_ID__` placeholder, so build-lab.mjs treats it as pending and excludes it | Provision the D1, paste id into `apps/foo/wrangler.jsonc`, `pnpm deploy:all` |
| Full-stack app `/api` 500 | `schema.ts` not exporting required name | Check it exports `schema` (singular, exact name) |
| Auth fails silently | App's `BETTER_AUTH_SECRET` missing | `cd apps/<slug> && echo -n "$(openssl rand -base64 36)" \| npx wrangler secret put BETTER_AUTH_SECRET` |
| Hits Workers daily limit (100k) | Free tier exceeded | Upgrade to Workers Paid ($5/mo) or look for runaway requests |
| "Database not found" on first request | D1 not yet migrated | `cd apps/<slug> && pnpm db:migrate:remote` |
| `pnpm deploy:root` errors with "Service binding 'APP_FOO' references Worker '…' which was not found" | Build ran with a stale fullstack app entry, OR you deleted a fullstack app's Worker without re-running build | `pnpm build` again so the service-bindings list is rewritten to match reality |

---

## Why this structure

A lab is for **experiments**. Most things you build here are throwaway; a few will grow. This layout optimizes for:

- **Cheap to add**: one file (page) or one folder (app), nothing else.
- **Cheap to delete**: remove the file/folder; build script stops including it.
- **Cheap to graduate**: a full-stack app is *already* its own Worker and its own D1. To extract it: copy folder to a new repo, change wrangler.jsonc's name + custom domain.
- **Independent**: each full-stack app is its own Worker, its own D1, its own auth realm. Bundle limits don't aggregate; one app's schema migration can't break another.
- **Framework-flexible**: the lab doesn't dictate framework. TanStack Start by default, but Hono+Vite, Astro, or anything Workers-compatible works.
- **No vendor lock-in beyond Cloudflare**: pages and static apps are plain web; full-stack apps use standard Drizzle + Better Auth that work anywhere.

The cost is a real ceiling: **at most 10 full-stack apps per Cloudflare account on the free tier** (D1 database limit). Workers free tier allows 100 Workers per account, so the bottleneck is D1 not Worker count. For a personal lab, 10 is plenty. If you hit it, either delete dormant apps, upgrade to Workers Paid (50,000 D1 limit), or migrate cold apps to KV / Durable Objects.

---

## Graduating an app

When a lab app outgrows the lab, see `GRADUATION.md` for the migration steps. Short version:

1. Copy `apps/<slug>/` to a new repo.
2. Move `wrangler.jsonc` so the Worker name is no longer prefixed with the lab.
3. Either keep the D1 (rename it) or run a fresh migration to a new D1.
4. Remove the app folder from this lab; root build script will stop including it.
5. The graduating app's URL changes from `<lab>.<domain>/apps/<slug>/*` to its own subdomain.

Apps that started life on TanStack Start in this lab graduate cleanly to a standalone TanStack Start project — same framework, same Cloudflare deployment, just standalone.
