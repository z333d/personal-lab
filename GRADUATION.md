# Graduating an App

When an app outgrows the lab and deserves its own repo, here's how to extract it cleanly.

## Static apps

These are simpler to graduate — they have no DB or auth state to migrate.

1. **Copy the folder**: `cp -R apps/<slug>/ /path/to/new-repo/`
2. **Add a wrangler config**: a static React app on its own needs either Cloudflare Pages or a tiny Workers + Static Assets setup. For Pages, just `wrangler pages deploy dist/`.
3. **Optional: own domain**. Add a custom domain in Cloudflare; point it at the new project.
4. **Remove from this lab**: `rm -rf apps/<slug>/`. Next build will stop including it.

## Fullstack apps

Fullstack apps in this lab are *already* their own Worker with their own D1 — graduating mostly means changing the Worker name and the routing.

1. **Copy the folder**: `cp -R apps/<slug>/ /path/to/new-repo/`
2. **Edit `wrangler.jsonc`**:
   - `name`: drop the lab prefix. Was `example-lab-todo`, becomes just `todo` or `mytodo`.
   - Custom domain: set up `routes` or a `workers_dev` URL for the new standalone form.
3. **Decide on the D1**:
   - **Option A: keep the existing D1**. Rename it (`wrangler d1 list` to find it, then `wrangler d1 rename`). Update the binding in the new repo's `wrangler.jsonc`. All existing user data and content carries over.
   - **Option B: fresh D1**. Run `wrangler d1 create` in the new repo. Run migrations. Lose the old data.
4. **Set the secrets in the new repo**: `wrangler secret put BETTER_AUTH_SECRET` (generate a fresh one if Option B; reuse if Option A so existing sessions survive). Set `BETTER_AUTH_URL` to the new standalone domain. Set `APP_BASE_PATH` to whatever the new app's path prefix is (probably `''`).
5. **Update the Better Auth client** in the new repo's frontend to point at the new origin (was `<lab-domain>/apps/<slug>/api/auth`, becomes `<new-domain>/api/auth`).
6. **Remove from this lab**: `rm -rf apps/<slug>/`. The build script will stop including it. Optionally delete the `<lab>-<slug>` D1 and the lab Worker for it.
7. **Update DNS**: the lab's Workers Route for `<lab>.<domain>/apps/<slug>/*` should be removed (it'll just 404 to the root Worker after that, which is fine).

## TanStack Start apps

TanStack Start apps that started life in the lab graduate cleanly to standalone TanStack Start projects — same framework, same Cloudflare deployment story, just no parent Worker dispatching paths.

If you originally scaffolded with `--framework tanstack-start`, the steps above are sufficient. The framework's own deployment guide
([tanstack.com/start/docs](https://tanstack.com/start/docs)) covers the standalone-deployment specifics.

## Hono + Vite apps

If you originally scaffolded with `--framework hono-vite`, the resulting project is essentially a small standalone Worker with a static SPA. Graduating is a name + domain change, plus replacing any imports from `@lab/lib` with copies of the helper code (since the lab workspace package is no longer in scope).

Suggested approach:
1. Copy `lib/src/auth-setup.ts`, `lib/src/auth-schema.ts`, `lib/src/db.ts` into the new repo (e.g. into a `src/lib/` directory).
2. Replace `import { ... } from '@lab/lib'` with the new local path.
3. Bump the package's `name` and remove the `lab.fullstack: true` field (no longer relevant).

## When NOT to graduate

If the app is fine as-is and you don't need a separate domain or marketing surface, don't bother. The lab can host hundreds of HTML pages and static apps cheaply and a handful of fullstack apps. Graduation is for when an app needs:
- A standalone identity (its own domain, branding, marketing pages)
- A different release cadence than the lab
- Different access control (e.g., enterprise SSO)
- More than the lab's per-Worker resource budget

Until any of those is true, leave it in the lab and keep iterating.
