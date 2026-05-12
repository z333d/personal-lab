#!/usr/bin/env node
/**
 * scaffold.mjs — add a new page or app to an existing lab.
 *
 * Usage:
 *   node scripts/scaffold.mjs page <slug>                   - create pages/<slug>.html
 *   node scripts/scaffold.mjs app  <slug>                   - create apps/<slug>/ (static React)
 *   node scripts/scaffold.mjs app  <slug> --fullstack       - create apps/<slug>/ (fullstack)
 *   node scripts/scaffold.mjs app  <slug> --fullstack --deploy
 *                                                            - scaffold + provision D1
 *                                                              + migration + secrets + deploy
 *
 * Static apps copy from apps/counter/. Fullstack apps copy from apps/todo/.
 * Without --deploy you'll need to commit + run the deploy lifecycle manually
 * (see README "Day-to-day usage"). With --deploy the new app is live when the
 * command returns.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const kind = positional[0];
const slug = positional[1];

if (!kind || !slug) {
  console.error(`Usage:
  node scripts/scaffold.mjs page <slug>                   # HTML page
  node scripts/scaffold.mjs app  <slug>                   # static React app
  node scripts/scaffold.mjs app  <slug> --fullstack       # fullstack app
  node scripts/scaffold.mjs app  <slug> --fullstack --deploy   # one-command create
  node scripts/scaffold.mjs r2   <bucket>                 # provision a Cloudflare R2 bucket
  node scripts/scaffold.mjs rm   <slug> [--yes]           # remove a page / app (destructive)
`);
  process.exit(1);
}

// r2 has its own slug rule (R2 accepts longer names and we don't ship the bucket
// through pnpm workspaces, so we don't need the strict app-slug regex).
if (kind === 'r2') {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) {
    console.error('R2 bucket name must be 3–63 chars, lowercase alphanumeric or hyphen, not starting/ending with hyphen.');
    process.exit(1);
  }
  await provisionR2Bucket(slug);
  process.exit(0);
}

if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
  console.error('Slug must be 3–40 chars lowercase kebab-case starting with a letter.');
  process.exit(1);
}

const wantsDeploy = flags.has('--deploy');

if (kind === 'rm') {
  await removeBySlug(slug, flags.has('--yes'));
  process.exit(0);
}

if (kind === 'page') {
  const target = path.join(LAB_ROOT, 'pages', `${slug}.html`);
  if (fs.existsSync(target)) {
    console.error(`Already exists: ${target}`);
    process.exit(1);
  }
  fs.writeFileSync(target, htmlPageTemplate(slug));
  console.log(`✓ Created ${path.relative(LAB_ROOT, target)}`);
  if (wantsDeploy) {
    deployRootBundle();
    console.log(`  Live at /pages/${slug}.html`);
  } else {
    console.log(`  Edit it, then commit. Live at /pages/${slug}.html after push.`);
  }
  process.exit(0);
}

if (kind !== 'app') {
  console.error(`Unknown kind: ${kind}`);
  process.exit(1);
}

const fullstack = flags.has('--fullstack');
const sourceApp = fullstack ? 'todo' : 'counter';
const sourceDir = path.join(LAB_ROOT, 'apps', sourceApp);
const targetDir = path.join(LAB_ROOT, 'apps', slug);

if (!fs.existsSync(sourceDir)) {
  console.error(`Source template not found: apps/${sourceApp}/. Are you running this from a lab created via create-lab.mjs?`);
  process.exit(1);
}
if (fs.existsSync(targetDir)) {
  console.error(`App already exists: ${targetDir}`);
  process.exit(1);
}

console.log(`Copying apps/${sourceApp}/ → apps/${slug}/...`);
copyDir(sourceDir, targetDir, ['node_modules', 'dist', '.wrangler']);

// Substitute names in the new app: the slug appears as lowercase identifier,
// SCREAMING_CASE constant, and a Title-Case display label (HTML <title>, etc.).
substituteInDir(targetDir, sourceApp, slug);
substituteInDir(targetDir, sourceApp.toUpperCase(), slug.toUpperCase());
substituteInDir(targetDir, capitalize(sourceApp), capitalize(slug));

// Update package.json fields explicitly
const pkgPath = path.join(targetDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = `@lab/${slug}`;
pkg.lab = pkg.lab || {};
pkg.lab.title = capitalize(slug);
pkg.lab.description = fullstack
  ? `Fullstack app — login + DB. Edit apps/${slug}/ to make it yours.`
  : `Static React app. Edit apps/${slug}/src/ to make it yours.`;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// Neutralize brand surfaces — the source app (todo / counter) ships with
// its own opinionated DESIGN.md and themed App.tsx. We don't want a fresh
// scaffold to silently inherit Notebook or Terminal vibes, because the
// agent might then iterate on top of a brand the user never asked for.
writeNeutralDesignMd(targetDir, slug);
writeNeutralAppTsx(targetDir, slug, fullstack);

if (fullstack) {
  // The source fullstack app (todo) has business-specific code that breaks
  // a naive slug substitution: `todos` (schema identifier) becomes invalid
  // when the slug contains a hyphen (e.g. `demo-fulls` is not valid JS).
  // Strip the source/schema/migrations down to auth-only so a fresh scaffold
  // is a clean blank canvas the user can extend.
  writeNeutralServerIndex(targetDir, slug);
  writeNeutralSchema(targetDir);
  clearCopiedMigrations(targetDir);
  resetD1IdPlaceholder(targetDir, slug);
}

// Wire the new workspace into the lab's node_modules (fresh apps need their
// own vite/react/etc. installed via the workspace; without this `pnpm build`
// fails on the next run).
//
// pnpm 10 caches workspace state at node_modules/.pnpm-workspace-state.json.
// A plain `pnpm install` after we drop a new apps/<slug>/ on disk says
// "Already up to date" and refuses to create apps/<slug>/node_modules —
// even though the new package is recognized in pnpm-workspace.yaml.
// Removing the cache file forces pnpm to re-validate and create the symlinks.
const workspaceState = path.join(LAB_ROOT, 'node_modules', '.pnpm-workspace-state.json');
if (fs.existsSync(workspaceState)) fs.unlinkSync(workspaceState);

console.log(`Installing workspace dependencies...`);
const installRes = spawnSync('pnpm', ['install'], { cwd: LAB_ROOT, stdio: 'inherit' });
if (installRes.status !== 0) {
  console.warn(`  (pnpm install failed — run it manually before building)`);
}

// Regenerate theme.generated.css from the new neutral DESIGN.md so a fresh
// `pnpm dev` works immediately without an extra step.
console.log(`Generating neutral theme...`);
const themeRes = spawnSync('pnpm', ['--filter', `@lab/${slug}`, 'theme:gen'], {
  cwd: LAB_ROOT,
  stdio: 'inherit',
});
if (themeRes.status !== 0) {
  console.warn(`  (theme:gen failed — run \`pnpm --filter @lab/${slug} theme:gen\` manually)`);
}

if (fullstack) {
  // Let drizzle-kit produce the initial migration so the meta journal +
  // snapshot match the .sql on disk. Without this, a later `pnpm db:generate`
  // (after the user adds business tables) would re-baseline as 0000_<random>
  // alongside our hand-written 0000_init.sql, and `deploy:all` would try to
  // apply both → "table already exists" on the second one.
  console.log(`Generating initial drizzle migration...`);
  const genRes = spawnSync('pnpm', ['--filter', `@lab/${slug}`, 'db:generate', '--name', 'init'], {
    cwd: LAB_ROOT,
    stdio: 'inherit',
  });
  if (genRes.status !== 0) {
    console.warn(`  (db:generate failed — run \`pnpm --filter @lab/${slug} db:generate --name init\` manually)`);
  }
}

console.log(`✓ Created apps/${slug}/`);
console.log(`  Brand surfaces neutralized — DESIGN.md is a placeholder.`);
console.log(`  Before building UI, ask the user what vibe (editorial / playful / utilitarian / dark / etc.)`);
console.log(`  and rewrite DESIGN.md, then \`pnpm theme:gen\` to refresh tokens.`);

if (wantsDeploy) {
  if (fullstack) {
    deployFullstackApp(slug);
  } else {
    deployRootBundle();
    console.log(`  Live at /apps/${slug}/`);
  }
} else if (fullstack) {
  console.log(`\nFullstack apps need a per-app D1 + secrets before they can deploy. Either:`);
  console.log(`  • Re-run with --deploy: \`pnpm scaffold app ${slug} --fullstack --deploy\``);
  console.log(`  • Or do it by hand:`);
  console.log(`      npx wrangler d1 create <lab>-${slug}`);
  console.log(`      → paste the returned database_id into apps/${slug}/wrangler.jsonc`);
  console.log(`      cd apps/${slug} && pnpm db:migrate:remote`);
  console.log(`      echo -n "$(openssl rand -base64 36)" | npx wrangler secret put BETTER_AUTH_SECRET`);
  console.log(`      echo -n "https://<lab>.<your-domain>" | npx wrangler secret put BETTER_AUTH_URL`);
  console.log(`      cp .dev.vars.example .dev.vars  # optional; only for local \`pnpm dev\` auth`);
  console.log(`      cd ../.. && pnpm build && pnpm deploy:all`);
} else {
  console.log(`\nNext: edit apps/${slug}/src/App.tsx, then \`pnpm deploy:root\` (or \`--deploy\` next time).`);
}

// ────────── --deploy helpers ──────────

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
  return r;
}

function readLabName() {
  const pkg = JSON.parse(fs.readFileSync(path.join(LAB_ROOT, 'package.json'), 'utf8'));
  return pkg.name;
}

function readUserConfig() {
  const primary = path.join(os.homedir(), '.config', 'personal-lab', 'config.json');
  const legacy = path.join(os.homedir(), '.config', 'create-pages-site', 'config.json');
  for (const p of [primary, legacy]) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error(
    `No user config found at ${primary}. Run \`node scripts/setup.mjs\` first.`,
  );
}

function computeLabBaseUrl(labName, cfg) {
  // Prefer the route declared in server/wrangler.jsonc (template — has the
  // canonical lab URL the user picked). Falls back to workers.dev pattern.
  const rootWf = path.join(LAB_ROOT, 'server', 'wrangler.jsonc');
  if (fs.existsSync(rootWf)) {
    const text = fs.readFileSync(rootWf, 'utf8');
    // routes was already substituted by create-lab.mjs at lab creation time.
    // Look for `"pattern": "<domain>"` (custom_domain: true case).
    const m = text.match(/"pattern":\s*"([^"\/]+)"/);
    if (m) return `https://${m[1]}`;
  }
  const accountSub = cfg.cloudflareEmail?.split('@')[0] || 'account';
  return `https://${labName}.${accountSub}.workers.dev`;
}

function findExistingD1Id(cwd, dbName) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'list', '--json'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status === 0) {
    try {
      const list = JSON.parse(r.stdout.toString());
      const found = list.find((d) => d.name === dbName);
      if (found) return found.uuid;
    } catch { /* fall through */ }
  }
  return null;
}

function setSecret(cwd, name, value) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`wrangler secret put ${name} failed`);
}

function deployRootBundle() {
  console.log(`\nBuilding + deploying root Worker...`);
  run('pnpm', ['build'], { cwd: LAB_ROOT });
  run('pnpm', ['deploy:root'], { cwd: LAB_ROOT });
}

function deployFullstackApp(slug) {
  const appDir = path.join(LAB_ROOT, 'apps', slug);
  const labName = readLabName();
  const cfg = readUserConfig();
  const labBaseUrl = computeLabBaseUrl(labName, cfg);
  const dbName = `${labName}-${slug}`;
  const placeholder = `__D1_${slug.toUpperCase().replace(/-/g, '_')}_ID__`;
  const wranglerPath = path.join(appDir, 'wrangler.jsonc');

  // 1. Create or find D1
  console.log(`\n▸ Provisioning D1 ${dbName}`);
  let dbId = findExistingD1Id(LAB_ROOT, dbName);
  if (!dbId) {
    const r = spawnSync('npx', ['wrangler', 'd1', 'create', dbName], {
      cwd: appDir,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const out = r.stdout.toString();
    if (r.status !== 0) throw new Error(`wrangler d1 create failed:\n${out}`);
    const m = out.match(/database_id\s*=\s*"([^"]+)"|"database_id":\s*"([^"]+)"/);
    dbId = m ? (m[1] || m[2]) : findExistingD1Id(LAB_ROOT, dbName);
    if (!dbId) throw new Error(`Could not extract database_id for ${dbName}:\n${out}`);
    console.log(`  created (id=${dbId})`);
  } else {
    console.log(`  reusing existing D1 (id=${dbId})`);
  }

  // 2. Substitute the placeholder in wrangler.jsonc (idempotent)
  const wText = fs.readFileSync(wranglerPath, 'utf8');
  if (wText.includes(placeholder)) {
    fs.writeFileSync(wranglerPath, wText.split(placeholder).join(dbId));
    console.log(`  wrote database_id into apps/${slug}/wrangler.jsonc`);
  }

  // 3. Apply migrations
  console.log(`\n▸ Applying migrations`);
  run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote'], { cwd: appDir });

  // 4. Set production secrets (wrangler auto-creates an empty Worker if needed)
  console.log(`\n▸ Setting production secrets`);
  const prodSecret = randomBytes(48).toString('base64url');
  setSecret(appDir, 'BETTER_AUTH_SECRET', prodSecret);
  setSecret(appDir, 'BETTER_AUTH_URL', labBaseUrl);

  // 5. Write .dev.vars for local dev (different secret from prod)
  const devVarsPath = path.join(appDir, '.dev.vars');
  if (!fs.existsSync(devVarsPath)) {
    const devSecret = randomBytes(48).toString('base64url');
    fs.writeFileSync(
      devVarsPath,
      `BETTER_AUTH_SECRET=${devSecret}\nBETTER_AUTH_URL=http://localhost:8787\n`,
    );
    console.log(`  wrote apps/${slug}/.dev.vars (local-dev secret, separate from prod)`);
  }

  // 6. Build + deploy everything
  console.log(`\n▸ Build + deploy`);
  run('pnpm', ['build'], { cwd: LAB_ROOT });
  run('pnpm', ['deploy:all'], { cwd: LAB_ROOT });

  console.log(`\n✨ ${slug} is live at ${labBaseUrl}/apps/${slug}/`);
}

// ────────── rm helpers ──────────

async function removeBySlug(slug, skipPrompt) {
  const pagePath = path.join(LAB_ROOT, 'pages', `${slug}.html`);
  const appDir = path.join(LAB_ROOT, 'apps', slug);
  const isPage = fs.existsSync(pagePath);
  const isApp = fs.existsSync(appDir);

  if (!isPage && !isApp) {
    console.error(`Nothing to remove: no pages/${slug}.html or apps/${slug}/.`);
    process.exit(1);
  }

  let isFullstack = false;
  if (isApp) {
    const pkgPath = path.join(appDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      isFullstack = !!pkg.lab?.fullstack;
    }
  }

  // Describe what will go
  const targets = [];
  if (isPage) targets.push(`pages/${slug}.html`);
  if (isApp) targets.push(`apps/${slug}/`);
  if (isFullstack) {
    const labName = readLabName();
    targets.push(`Cloudflare Worker "${labName}-${slug}"`);
    targets.push(`Cloudflare D1 database "${labName}-${slug}" (and all its data)`);
  }

  console.log(`\nAbout to remove:`);
  for (const t of targets) console.log(`  - ${t}`);
  console.log(``);
  if (isFullstack) {
    console.log(`\x1b[33mThe D1 deletion is irreversible.\x1b[0m`);
  }

  if (!skipPrompt) {
    const ok = await promptYesNo(`Continue? (y/N) `);
    if (!ok) {
      console.log(`Cancelled.`);
      process.exit(0);
    }
  }

  if (isFullstack) {
    const labName = readLabName();
    console.log(`\n▸ Delete Worker ${labName}-${slug}`);
    spawnSync('npx', ['wrangler', 'delete', '--name', `${labName}-${slug}`, '--force'], { stdio: 'inherit' });
    // wrangler delete returns non-zero if the worker doesn't exist — that's fine; carry on.

    console.log(`\n▸ Delete D1 ${labName}-${slug}`);
    spawnSync('npx', ['wrangler', 'd1', 'delete', `${labName}-${slug}`, '--skip-confirmation'], { stdio: 'inherit' });
  }

  if (isPage) {
    fs.unlinkSync(pagePath);
    console.log(`\n✓ Removed pages/${slug}.html`);
  }
  if (isApp) {
    fs.rmSync(appDir, { recursive: true, force: true });
    console.log(`✓ Removed apps/${slug}/`);
  }

  // Rebuild + redeploy root so the service binding (if any) and the static
  // assets disappear from production. pnpm install isn't needed — pnpm picks
  // up the workspace change next time anyway.
  console.log(`\n▸ Rebuild + redeploy root Worker`);
  run('pnpm', ['build'], { cwd: LAB_ROOT });
  run('pnpm', ['deploy:root'], { cwd: LAB_ROOT });
  console.log(`\n✓ ${slug} is gone.`);
}

async function promptYesNo(question) {
  const { default: readline } = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

// ────────── r2 helpers ──────────

async function provisionR2Bucket(bucket) {
  const labName = readLabName();
  // Prefix the bucket with the lab name so multiple labs in one Cloudflare
  // account don't collide on bucket names.
  const fullName = `${labName}-${bucket}`;
  const bindingName = `R2_${bucket.toUpperCase().replace(/-/g, '_')}`;

  console.log(`\n▸ Creating R2 bucket "${fullName}"...`);
  const r = spawnSync('npx', ['wrangler', 'r2', 'bucket', 'create', fullName], {
    cwd: LAB_ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error(`\nwrangler r2 bucket create failed. Common causes:`);
    console.error(`  - A bucket named "${fullName}" already exists in this account`);
    console.error(`  - Your Cloudflare plan doesn't include R2 (it's free up to 10 GB)`);
    process.exit(1);
  }

  console.log(`
✓ Bucket "${fullName}" is ready.

To bind it to a fullstack app, paste this block into apps/<app-slug>/wrangler.jsonc
(at the top level, alongside d1_databases / vars):

  "r2_buckets": [
    {
      "binding": "${bindingName}",
      "bucket_name": "${fullName}"
    }
  ]

Then in your Worker code you'll have \`env.${bindingName}\` (typed as R2Bucket) — use
\`env.${bindingName}.put(key, body)\` / \`env.${bindingName}.get(key)\` / etc.
Reference: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/

If the assets are public (images / fonts / videos served unauthenticated), enable
public access on the bucket in the Cloudflare dashboard:
  Storage → R2 → ${fullName} → Settings → Public access → Allow
Then reference assets via the public r2.dev URL or your own custom domain.

To remove later:
  npx wrangler r2 bucket delete ${fullName}
(This is irreversible — bucket contents are lost. There is no \`pnpm scaffold rm\` shortcut for R2 yet.)
`);
}

// ────────── Helpers ──────────

function copyDir(src, dst, skip) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const sp = path.join(src, entry.name);
    const dp = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp, skip);
    else if (entry.isFile()) fs.copyFileSync(sp, dp);
  }
}

function substituteInDir(dir, find, replace) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      substituteInDir(p, find, replace);
    } else if (entry.isFile()) {
      try {
        const before = fs.readFileSync(p, 'utf8');
        if (before.includes(find)) {
          fs.writeFileSync(p, before.split(find).join(replace));
        }
      } catch { /* binary */ }
    }
  }
}

function writeNeutralDesignMd(targetDir, slug) {
  const designPath = path.join(targetDir, 'DESIGN.md');
  if (!fs.existsSync(designPath)) return; // copy didn't bring one — skip silently
  const body = `---
version: alpha
name: Untitled
description: PLACEHOLDER. Tell the agent the vibe / brand / register you want for this app, then have them rewrite this file (colors, typography, radii) before they touch any UI. After editing, run \`pnpm theme:gen\` to regenerate theme.generated.css.
colors:
  primary: "#111111"
  primary-on: "#ffffff"
  secondary: "#666666"
  accent: "#0061d5"
  success: "#118850"
  danger: "#c0392b"
  surface: "#ffffff"
  surface-2: "#f5f5f5"
  border: "#e5e5e5"
  border-strong: "#cccccc"
  fg: "#111111"
  fg-muted: "#666666"
  fg-soft: "#999999"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  h1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  "2xl": 32px
  "3xl": 48px
---

# Untitled — Placeholder DESIGN.md

> **This file is a placeholder.** It produces a deliberately bland, system-flavored UI so a fresh scaffold doesn't silently look like another app's brand. Replace it with the brand you actually want, then run \`pnpm theme:gen\`.

## Before you write code

Ask the user (or yourself, if you are the user) two questions:

1. **What does this app do?** (One sentence is enough.)
2. **What vibe / register?** Editorial · playful · utilitarian · documentation · dark mode native · maximalist · minimalist · brutalist · pastel · industrial · etc.

Then rewrite the YAML front matter and the prose below — colors, typography, radii, do's and don'ts. Don't keep the placeholder values; pick a real palette and a real type system.

## Colors

The placeholder palette is pure system: white surface, near-black text, light gray borders, a generic blue accent. It looks fine but it has no personality. **Real apps should pick neutrals with a hint of chroma** (e.g., warm cream, cool slate, deep blue-black) and an accent that means something for the product.

## Typography

System sans for everything. Replace with whatever fits the brand — serif for editorial, monospace for dev tools, sans for product UI, etc.

## Spacing

Spacing values are reference only — they live in this file as documentation, not as Tailwind utility names (the build script intentionally avoids the \`--spacing-*\` namespace because it collides with Tailwind v4's \`max-w-md / max-w-xl\`). Use Tailwind's own scale (\`gap-4\` = 16px, \`py-6\` = 24px, etc.) in components.

## Do's and Don'ts

- ❌ Don't ship the placeholder palette to users — it screams "AI default."
- ❌ Don't reach for pure white / pure black / zero-chroma gray.
- ❌ Don't copy the brand from another app in this lab; each app gets its own register.
- ✅ Do pick a single accent color that points at the one thing that matters per view.
- ✅ Do leave a paragraph here explaining *why* you picked this palette — it helps the agent reason about future UI choices.
`;
  fs.writeFileSync(designPath, body);
}

function writeNeutralServerIndex(targetDir, slug) {
  const target = path.join(targetDir, 'src', 'server', 'index.ts');
  if (!fs.existsSync(target)) return;
  fs.writeFileSync(target, `/**
 * Worker for the ${slug} app.
 *
 * Mounts:
 *   /apps/${slug}/api/auth/*  → Better Auth handler (sign-in / sign-up / session)
 *   /apps/${slug}/api/me      → current user
 *   /apps/${slug}/*           → static SPA via ASSETS binding
 *
 * Auth is wired but no business endpoints exist yet. Add tables to
 * shared/schema.ts (and regenerate migrations via \`pnpm db:generate\`),
 * then add routes here.
 */
import { Hono } from 'hono';
import { createAppAuth, type AuthEnv } from '@lab/lib';
import { schema } from '../../shared/schema';

type Env = AuthEnv & {
  ASSETS: Fetcher;
};

type Variables = {
  user: { id: string; email: string; name: string } | null;
  session: { id: string; userId: string } | null;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.on(['GET', 'POST'], '/apps/${slug}/api/auth/*', (c) => {
  const auth = createAppAuth(c.env, schema);
  return auth.handler(c.req.raw);
});

app.use('/apps/${slug}/api/*', async (c, next) => {
  const auth = createAppAuth(c.env, schema);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', (session?.user as Variables['user']) ?? null);
  c.set('session', (session?.session as Variables['session']) ?? null);
  await next();
});

app.get('/apps/${slug}/api/me', (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
});

app.get('/apps/${slug}/api/health', (c) => c.json({ ok: true, app: '${slug}' }));

export default app;
`);
}

function writeNeutralSchema(targetDir) {
  const target = path.join(targetDir, 'shared', 'schema.ts');
  if (!fs.existsSync(target)) return;
  fs.writeFileSync(target, `/**
 * Drizzle schema for this app's D1 database.
 *
 * The placeholder schema is auth-only. When you add business tables,
 * append them here and re-export them under \`schema\`, then run
 * \`pnpm db:generate\` (inside the app) to produce a fresh migration.
 */
import { authSchema } from '@lab/lib/auth-schema';

export const { user, session, account, verification } = authSchema;

// REQUIRED: build script and runtime expect this exact name.
export const schema = { user, session, account, verification };
`);
}

function clearCopiedMigrations(targetDir) {
  // Wipe whatever was copied from the source app's drizzle/migrations/.
  // We do NOT hand-write a replacement 0000_init.sql here; instead, after
  // `pnpm install`, the scaffold script runs `drizzle-kit generate --name init`
  // so the .sql, _journal.json, and 0000_snapshot.json are all produced
  // together and stay consistent with each other. That keeps future
  // `pnpm db:generate` invocations incremental (producing 0001_*.sql for
  // newly added tables) instead of re-baselining from scratch.
  const migDir = path.join(targetDir, 'drizzle', 'migrations');
  if (!fs.existsSync(migDir)) return;
  for (const entry of fs.readdirSync(migDir, { withFileTypes: true })) {
    fs.rmSync(path.join(migDir, entry.name), { recursive: true, force: true });
  }
}

function resetD1IdPlaceholder(targetDir, slug) {
  // Copy from todo brings todo's real D1 UUID; replace it with a marker so a
  // subsequent deploy fails loudly instead of silently pointing at todo's DB.
  const wf = path.join(targetDir, 'wrangler.jsonc');
  if (!fs.existsSync(wf)) return;
  const text = fs.readFileSync(wf, 'utf8');
  const stripped = text.replace(
    /"database_id":\s*"[^"]+"/,
    `"database_id": "__D1_${slug.toUpperCase().replace(/-/g, '_')}_ID__"`,
  );
  fs.writeFileSync(wf, stripped);
}

function writeNeutralAppTsx(targetDir, slug, fullstack) {
  const appName = capitalize(slug);
  if (fullstack) {
    const target = path.join(targetDir, 'src', 'client', 'App.tsx');
    if (!fs.existsSync(target)) return;
    fs.writeFileSync(target, fullstackAppTemplate(slug, appName));
  } else {
    const target = path.join(targetDir, 'src', 'App.tsx');
    if (!fs.existsSync(target)) return;
    fs.writeFileSync(target, staticAppTemplate(slug, appName));
  }
}

function staticAppTemplate(slug, appName) {
  return `import { Button } from './components/ui/button';

/**
 * Placeholder App for ${slug}.
 *
 * This is a neutral starter. Before building UI:
 *   1. Ask the user what this app does + what vibe they want.
 *   2. Rewrite apps/${slug}/DESIGN.md (colors, typography, radii).
 *   3. Run \`pnpm theme:gen\` to refresh tokens.
 *   4. Then replace this file with the real UI.
 */
export function App() {
  return (
    <main className="min-h-screen bg-surface text-fg">
      <div className="max-w-md mx-auto py-16 px-6 flex flex-col gap-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-xl font-semibold">${appName}</h1>
          <p className="text-sm text-fg-muted mt-1">A new static React app, freshly scaffolded.</p>
        </header>
        <section className="flex flex-col gap-3 text-sm text-fg-muted leading-relaxed">
          <p>This is a neutral placeholder. The brand lives in <code className="text-fg">apps/${slug}/DESIGN.md</code> — it currently uses generic system styling.</p>
          <p>Tell the agent what to build and what vibe you want. They'll update <code className="text-fg">DESIGN.md</code>, run <code className="text-fg">pnpm theme:gen</code>, and replace this <code className="text-fg">src/App.tsx</code>.</p>
        </section>
        <div className="pt-2">
          <Button>Sample button</Button>
        </div>
        <p className="text-xs text-fg-soft pt-4 border-t border-border">apps/${slug}/src/App.tsx</p>
      </div>
    </main>
  );
}
`;
}

function fullstackAppTemplate(slug, appName) {
  return `import { useEffect, useState } from 'react';
import { authClient } from './auth-client';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

const API = '/apps/${slug}/api';

type User = { id: string; email: string; name: string };

/**
 * Placeholder App for ${slug}.
 *
 * Auth flow is wired (Better Auth + D1) so you can sign up and sign in
 * out of the box. Everything else is a neutral starter.
 *
 * Before building UI:
 *   1. Ask the user what this app does + what vibe they want.
 *   2. Rewrite apps/${slug}/DESIGN.md (colors, typography, radii).
 *   3. Run \`pnpm theme:gen\` to refresh tokens.
 *   4. Update src/server/index.ts (API + schema) and replace this file.
 */
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    setLoading(true);
    try {
      const res = await fetch(\`\${API}/me\`);
      if (res.ok) {
        const data = (await res.json()) as { user: User };
        setUser(data.user);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refreshMe(); }, []);

  if (loading) {
    return (
      <main className="max-w-md mx-auto py-16 px-6">
        <p className="text-sm text-fg-soft">Loading…</p>
      </main>
    );
  }
  if (!user) return <AuthForm onAuth={refreshMe} />;
  return <SignedIn user={user} onSignOut={async () => { await authClient.signOut(); refreshMe(); }} />;
}

function AuthForm({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error } = await authClient.signUp.email({ email, password, name });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      }
      onAuth();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-md mx-auto py-16 px-6 flex flex-col gap-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-fg">${appName}</h1>
        <p className="text-sm text-fg-muted mt-1">Sign in or create an account to continue.</p>
      </header>

      <div className="flex items-baseline gap-3 text-sm">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={mode === 'signin' ? 'text-fg font-medium' : 'text-fg-muted hover:text-fg'}
        >
          Sign in
        </button>
        <span className="text-fg-soft">·</span>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={mode === 'signup' ? 'text-fg font-medium' : 'text-fg-muted hover:text-fg'}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="text-xs text-fg-soft pt-4 border-t border-border">apps/${slug}/src/client/App.tsx</p>
    </main>
  );
}

function SignedIn({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <main className="max-w-md mx-auto py-16 px-6 flex flex-col gap-6">
      <header className="flex items-baseline justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold text-fg">${appName}</h1>
          <p className="text-sm text-fg-muted mt-1">Hello, {user.name || user.email}.</p>
        </div>
        <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
      </header>
      <section className="flex flex-col gap-3 text-sm text-fg-muted leading-relaxed">
        <p>You're signed in. Auth is wired with Better Auth + D1.</p>
        <p>This is a neutral placeholder — the brand lives in <code className="text-fg">apps/${slug}/DESIGN.md</code>. Tell the agent what to build (and what vibe), and they'll rewrite the brand and replace this view.</p>
      </section>
      <p className="text-xs text-fg-soft pt-4 border-t border-border">apps/${slug}/src/client/App.tsx</p>
    </main>
  );
}
`;
}

function htmlPageTemplate(slug) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${capitalize(slug)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 80px auto; padding: 0 24px; line-height: 1.6; color: #1a1a1f; }
    h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>${capitalize(slug)}</h1>
  <p>Edit pages/${slug}.html to customize this page.</p>
</body>
</html>
`;
}

function capitalize(s) {
  return s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
