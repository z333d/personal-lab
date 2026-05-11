# AGENTS.md

This is a **lab repo** — a multi-app workspace deployed across a small fleet of Cloudflare Workers under a single domain. Pages, static React apps, and full-stack apps live side by side. Adding new content is a one-file or one-folder operation; you (an agent or a human) never need to touch infrastructure.

This document tells you how to operate inside this repo. Any AI coding agent — Claude Code, Cursor, OpenCode, Gemini CLI, Codex, etc. — should follow these rules.

## What you can build

| Kind | Where it lives | URL | Backed by |
|---|---|---|---|
| HTML page | `pages/<slug>.html` | `/<slug>.html` *and* `/pages/<slug>.html` | root Worker |
| Static React app | `apps/<slug>/` (no `db.ts`) | `/apps/<slug>/` | root Worker |
| Full-stack app (login + DB) | `apps/<slug>/` (own `wrangler.jsonc` + framework) | `/apps/<slug>/*` | own Worker |

All URLs sit under one lab domain (`https://<lab>.<your-domain>` or `https://<lab>.<account>.workers.dev`). Cloudflare Workers Routes do the path-prefix dispatching.

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
# Default: TanStack Start (rich DX, file routing, server functions)
pnpm scaffold app <slug> --fullstack

# Or pick a lighter framework
pnpm scaffold app <slug> --fullstack --framework hono-vite
pnpm scaffold app <slug> --fullstack --framework astro
```

A full-stack app is a **complete child project** with its own framework, its own `wrangler.jsonc`, and its own Worker on deploy. The skill scaffolds the whole thing; the lab's build script wires it into the root Worker's path routing.

```
apps/<slug>/
├── wrangler.jsonc       # this app's Worker config (binding to D1, secrets, etc.)
├── package.json         # framework's standard package.json + "lab.fullstack": true
├── tsconfig.json
└── (framework-specific)
    ├── app/             # TanStack Start: file-based routes
    │   ├── routes/      #   - index.tsx, login.tsx, etc.
    │   └── server/      #   - server functions, helpers
    ├── src/             # Or Hono+Vite: traditional layout
    │   ├── client/
    │   ├── server/      #   - api.ts: Hono router
    │   └── shared/      #   - schema.ts: Drizzle schema
    └── …
```

After `git push` the build script automatically:

1. Creates a D1 database named `<lab>-<slug>` if it doesn't exist.
2. Runs Drizzle migrations against it (auth tables + business tables).
3. Runs `wrangler deploy` for this app's Worker.
4. Adds a Cloudflare Workers Route so `<lab-domain>/apps/<slug>/*` reaches this Worker.
5. Wires Better Auth with a per-app secret + cookie path scoped to `/apps/<slug>/`.
6. Pre-creates the lab owner's account on first deploy (using the email stored in lab config).

You never touch `wrangler.jsonc`, secrets, DNS, or migrations directly.

### TanStack Start app conventions

If you scaffolded with `--framework tanstack-start` (the default):

```
apps/<slug>/
├── app/
│   ├── routes/
│   │   ├── __root.tsx   # global layout, providers
│   │   ├── index.tsx    # landing page
│   │   └── api/
│   │       └── auth/
│   │           └── $.tsx  # Better Auth handler (auto-mounted)
│   ├── server/
│   │   └── auth.ts      # createAppAuth() — calls @lab/lib helper
│   └── lib/
│       └── auth-client.ts  # Better Auth React client
├── shared/
│   └── schema.ts        # Drizzle schema; export `schema`
└── wrangler.jsonc
```

- Add new pages by creating files in `app/routes/`.
- Add new API endpoints as TanStack Start server functions OR as routes under `app/routes/api/`.
- For DB queries, import the schema and use `getDb(env, schema)` from `@lab/lib`.

### Hono + Vite app conventions (lightweight alternative)

If you scaffolded with `--framework hono-vite`:

```
apps/<slug>/
├── src/
│   ├── client/          # Vite + React SPA
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── server/
│   │   └── api.ts       # Hono router; export `routes`
│   └── shared/
│       └── schema.ts    # Drizzle schema; export `schema`
└── wrangler.jsonc
```

- Hono router is mounted at the app's root (`/apps/<slug>/api/*`).
- React SPA built and served as static assets via Workers Static Assets binding.
- Better Auth handler is automatically composed into the Hono router.

### What `shared/schema.ts` must export (any framework)

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { authSchema } from '@lab/lib/auth-schema';

// Better Auth tables: user / session / account / verification
export const auth = authSchema;

// Your business tables
export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => auth.user.id),
  title: text('title').notNull(),
  done: integer('done', { mode: 'boolean' }).default(false),
});

// Export ALL tables as a single `schema` object — required name
export const schema = { ...auth, todos };
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

1. **Ask first** — before writing components or CSS for a new app (or a major redesign of an existing one), confirm with the user:
   - **What does this app do?** (one sentence)
   - **What vibe / register?** Editorial · playful · utilitarian · documentation · dark mode native · maximalist · minimalist · brutalist · pastel · industrial · etc. Offer 2–3 candidates if the user hasn't said.
2. **Rewrite `apps/<slug>/DESIGN.md`** to match — colors (with hint of chroma, never pure gray), typography, radii, plus a Markdown paragraph explaining *why this brand for this product*.
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

`pages/welcome.html` is a sample showing option (b) — it picks a notebook register because that fits *its* content. Don't read it as a default for new pages.

---

## Static assets (images, fonts, videos)

| Where | When | URL |
|---|---|---|
| `pages/<slug>-assets/` or `apps/<slug>/public/` | Small (< 1 MB), version with code | shipped via Workers Static Assets, free, automatic |
| Cloudflare R2 bucket | Large (> 1 MB), or many of them | `https://<bucket>.r2.dev/...`; not in git |

For now, R2 setup is manual. If you need it, ask the lab owner to run `pnpm scaffold r2 <bucket-name>`.

---

## Conventions you must follow

0. **Brand**: each app owns its own `DESIGN.md`. Never copy a brand from a sibling app without the user asking for it. See "Brand and DESIGN.md" above for the full workflow.
1. **Slugs** are lowercase kebab-case, 3–40 chars, must start with a letter.
2. **Don't** add new top-level directories. Only `pages/`, `apps/`, `lib/`, `scripts/`, `.github/` are expected.
3. **Don't** edit the lab's root `wrangler.jsonc` directly — it's regenerated on every build by `scripts/build-lab.mjs`.
4. **Per-app `wrangler.jsonc` is yours to read** but most edits should be done by the skill. If you must edit, mark it with a `// MANUAL:` comment so the build script preserves it.
5. **Don't** create migration files in `drizzle/` directories by hand — Drizzle generates them from `schema.ts`.
6. **Don't** put secrets in code or in committed `.env` files. Lab secrets are managed by `wrangler secret`. If you need a new secret, document it and have the lab owner set it.
7. **Don't** call across apps directly. Each full-stack app is a self-contained product with its own DB and auth realm. Sharing happens through code (`@lab/lib`) or through publishing a public API.
8. **Do** export `schema` (object) from any `shared/schema.ts` — the build script looks for this exact name.
9. **Do** keep apps small. If an app grows past significant scope, consider graduating it to its own repo (see `GRADUATION.md`).

## Things that are auto-managed (don't fight them)

- Root `wrangler.jsonc` (regenerated each build)
- Per-app `wrangler.jsonc` — initial generation; subsequent edits go through the skill or are marked `// MANUAL:`
- `dist/` — build output for the root Worker's static assets
- `drizzle/` directories per app — generated migrations
- D1 database creation per full-stack app
- Cloudflare Workers Routes (path-prefix dispatch from lab domain to per-app Workers)
- Better Auth secrets per app (auto-generated, stored in CF secrets)

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

`git push origin main` triggers GitHub Actions:

1. `pnpm build` — runs `scripts/build-lab.mjs`:
   - Discovers all pages, static apps, and full-stack apps
   - Builds each (Vite for static, framework's build for full-stack)
   - Generates root Worker bundle (serves static + dispatches paths)
   - Generates per-full-stack-app Worker bundles
2. `pnpm deploy:all` — wrangler deploy for root Worker + each full-stack Worker
3. New D1 databases are created on first deploy
4. Migrations run automatically per app

Manual: `pnpm deploy <slug>` to deploy just one app's Worker (skips full lab build).

---

## Common errors and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| `/apps/foo/` 404 | Worker Route not configured | Re-run `pnpm deploy foo`; check `wrangler workers domains list` |
| Full-stack app `/api` 500 | `schema.ts` not exporting required name | Check it exports `schema` (singular, exact name) |
| Auth fails silently | App's `BETTER_AUTH_SECRET` missing | Re-run `pnpm scaffold:auth-secret <slug>` |
| Hits Workers daily limit (100k) | Free tier exceeded | Upgrade to Workers Paid ($5/mo) or look for runaway requests |
| "Database not found" on first request | D1 not yet created or not migrated | Wait ~30s after first deploy or run `pnpm db:migrate <slug>` |
| Lab page lists app but clicking it 404s | App built but route not bound | Run `pnpm deploy <slug>` to ensure route exists |

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
