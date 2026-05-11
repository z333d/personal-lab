#!/usr/bin/env node
/**
 * scaffold.mjs — add a new page or app to an existing lab.
 *
 * Usage:
 *   node scripts/scaffold.mjs page <slug>                   - create pages/<slug>.html
 *   node scripts/scaffold.mjs app  <slug>                   - create apps/<slug>/ (static React)
 *   node scripts/scaffold.mjs app  <slug> --fullstack       - create apps/<slug>/ (fullstack)
 *
 * Static apps copy from apps/counter/. Fullstack apps copy from apps/todo/.
 * After running, you'll need to commit the new files. Deployment happens on
 * the next `git push` (or `pnpm deploy:all`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
`);
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
  console.error('Slug must be 3–40 chars lowercase kebab-case starting with a letter.');
  process.exit(1);
}

if (kind === 'page') {
  const target = path.join(LAB_ROOT, 'pages', `${slug}.html`);
  if (fs.existsSync(target)) {
    console.error(`Already exists: ${target}`);
    process.exit(1);
  }
  fs.writeFileSync(target, htmlPageTemplate(slug));
  console.log(`✓ Created ${path.relative(LAB_ROOT, target)}`);
  console.log(`  Edit it, then commit. Live at /pages/${slug}.html after push.`);
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

// Substitute names in the new app
substituteInDir(targetDir, sourceApp, slug);
substituteInDir(targetDir, sourceApp.toUpperCase(), slug.toUpperCase());

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
//
// Replace DESIGN.md with a system-flavored placeholder, and replace the
// app entry component with a "ready to build" shell. Both make it obvious
// that the next step is asking the user what vibe + feature they want.
writeNeutralDesignMd(targetDir, slug);
writeNeutralAppTsx(targetDir, slug, fullstack);

// Regenerate theme.generated.css from the new neutral DESIGN.md so a fresh
// `pnpm dev` works immediately without an extra step.
console.log(`Generating neutral theme...`);
const themeRes = spawnSync('pnpm', ['--filter', `@lab/${slug}`, 'theme:gen'], {
  cwd: LAB_ROOT,
  stdio: 'inherit',
});
if (themeRes.status !== 0) {
  console.warn(`  (theme:gen failed — run \`pnpm install\` then \`pnpm --filter @lab/${slug} theme:gen\` manually)`);
}

console.log(`✓ Created apps/${slug}/`);
console.log(`  Brand surfaces have been neutralized — DESIGN.md is a placeholder.`);
console.log(`  Before building UI, ask the user what vibe (editorial / playful / utilitarian / dark / etc.)`);
console.log(`  and rewrite DESIGN.md, then \`pnpm theme:gen\` to refresh tokens.`);
if (fullstack) {
  console.log(`\nNext steps:`);
  console.log(`  pnpm install`);
  console.log(`  cd apps/${slug} && npx wrangler d1 create <lab>-${slug}`);
  console.log(`    (paste the new database_id into apps/${slug}/wrangler.jsonc)`);
  console.log(`  pnpm db:generate    # in apps/${slug}/`);
  console.log(`  pnpm db:migrate:remote`);
  console.log(`  pnpm scaffold:auth-secret ${slug}   # if you have this script`);
  console.log(`\nThen edit apps/${slug}/src/ to build your feature, and 'git push' to deploy.`);
} else {
  console.log(`\nNext: pnpm install (if needed), edit apps/${slug}/src/App.tsx, git push to deploy.`);
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
