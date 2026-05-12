#!/usr/bin/env node
/**
 * build-lab.mjs — produces a deployable dist/ for the entire lab.
 *
 * What it does:
 *   1. Discover content under pages/, apps/.
 *   2. Build each Vite app (static or fullstack frontend).
 *   3. Copy pages/*.html into dist/client/pages/ AND dist/client/<file>.html
 *      (so /pages/foo.html and /foo.html both work).
 *   4. Build the root Worker bundle to dist/server/index.js.
 *   5. Generate dist/client/index.html (lab landing page) listing everything.
 *   6. Inject LAB_MANIFEST into root Worker's wrangler.jsonc via vars.
 *
 * What it does NOT do (handled by deploy-all.mjs):
 *   • Run wrangler deploy
 *   • Create D1 databases
 *   • Set Cloudflare Workers Routes
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(LAB_ROOT, 'dist');
const DIST_CLIENT = path.join(DIST, 'client');
const DIST_SERVER = path.join(DIST, 'server');
const PAGES_DIR = path.join(LAB_ROOT, 'pages');
const APPS_DIR = path.join(LAB_ROOT, 'apps');
const SERVER_DIR = path.join(LAB_ROOT, 'server');

// Read lab name from package.json
const labPkg = JSON.parse(fs.readFileSync(path.join(LAB_ROOT, 'package.json'), 'utf8'));
const LAB_NAME = labPkg.name;

console.log(`\n▸ Building lab: ${LAB_NAME}\n`);

// ────────── Reset dist ──────────
resetDir(DIST);
mkdirp(DIST_CLIENT);
mkdirp(DIST_SERVER);
mkdirp(path.join(DIST_CLIENT, 'pages'));
mkdirp(path.join(DIST_CLIENT, 'apps'));

// ────────── Discover content ──────────
const pages = discoverPages();
const apps = discoverApps();
const staticApps = apps.filter((a) => !a.fullstack);
const fullstackApps = apps.filter((a) => a.fullstack);
const activeFullstackApps = fullstackApps.filter((a) => !a.pending);
const pendingFullstackApps = fullstackApps.filter((a) => a.pending);

console.log(`  Found ${pages.length} HTML page(s), ${staticApps.length} static app(s), ${activeFullstackApps.length} fullstack app(s)` +
  (pendingFullstackApps.length ? ` (+ ${pendingFullstackApps.length} pending: ${pendingFullstackApps.map((a) => a.dirName).join(', ')})` : ''));

// ────────── 1. Copy HTML pages ──────────
for (const p of pages) {
  const src = path.join(PAGES_DIR, p.file);
  // /pages/<slug>.html
  copyFile(src, path.join(DIST_CLIENT, 'pages', p.file));
  // also at /<slug>.html for convenience (matches example-lab pattern)
  copyFile(src, path.join(DIST_CLIENT, p.file));
}

// Copy any sidecar asset directories under pages/
for (const entry of fs.existsSync(PAGES_DIR) ? fs.readdirSync(PAGES_DIR, { withFileTypes: true }) : []) {
  if (entry.isDirectory() && entry.name.endsWith('-assets')) {
    const src = path.join(PAGES_DIR, entry.name);
    const dst = path.join(DIST_CLIENT, 'pages', entry.name);
    copyDir(src, dst);
  }
}

// ────────── 2. Build each static app ──────────
for (const app of staticApps) {
  buildStaticApp(app);
}

// ────────── 3. Build each fullstack app (output stays inside apps/<slug>/dist) ──────────
for (const app of fullstackApps) {
  buildFullstackApp(app);
}

// ────────── 4. Build root Worker bundle ──────────
buildRootWorker();

// ────────── 4. Generate root wrangler.generated.jsonc (service bindings) ──────────
// Only "active" fullstack apps (D1 provisioned) get wired — referencing a not-yet-
// deployed Worker via service binding causes wrangler to fail the root deploy.
writeRootWranglerConfig({ fullstackApps: activeFullstackApps });

// ────────── 5. Generate lab landing page ──────────
writeLandingPage({ pages, staticApps, fullstackApps: activeFullstackApps });

// ────────── 5. Write manifest for status page ──────────
const manifest = {
  pages: pages.map((p) => ({ slug: p.slug, file: p.file })),
  staticApps: staticApps.map((a) => ({ slug: a.dirName, name: a.title })),
  fullstackApps: fullstackApps.map((a) => ({ slug: a.dirName, name: a.title, framework: a.framework })),
  builtAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(DIST, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`\n✓ Build complete. dist/client and dist/server ready for wrangler deploy.\n`);

// ════════════════════════════════════════════════════════════════
// Discovery
// ════════════════════════════════════════════════════════════════

function discoverPages() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs.readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((file) => {
      const slug = file.replace(/\.html$/, '');
      // A page can self-tag as a "starter example" with an HTML comment so
      // build-lab.mjs renders a small badge on the landing. Useful for the
      // demos that ship with a fresh lab so the user knows they can rm them.
      const content = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
      const isExample = /<!--\s*lab-example\s*-->/.test(content);
      return { file, slug, isExample };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function discoverApps() {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((entry) => {
      const dir = path.join(APPS_DIR, entry.name);
      const pkgPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgPath)) return null;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const fullstack = !!pkg.lab?.fullstack;
      // A fullstack app is "pending" until its D1 placeholder has been
      // replaced with a real id (i.e. someone ran `wrangler d1 create` and
      // pasted the id into wrangler.jsonc). Pending apps are excluded from
      // service bindings + landing so root deploys don't reference Workers
      // that haven't been deployed yet.
      let pending = false;
      if (fullstack) {
        const wf = path.join(dir, 'wrangler.jsonc');
        if (fs.existsSync(wf) && /__D1_[A-Z0-9_]+_ID__/.test(fs.readFileSync(wf, 'utf8'))) {
          pending = true;
        }
      }
      return {
        dirName: entry.name,
        dir,
        packageName: pkg.name,
        title: pkg.lab?.title || entry.name,
        description: pkg.lab?.description || '',
        framework: pkg.lab?.framework || (fullstack ? 'unknown' : 'static'),
        fullstack,
        pending,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dirName.localeCompare(b.dirName));
}

// ════════════════════════════════════════════════════════════════
// Build steps
// ════════════════════════════════════════════════════════════════

function buildStaticApp(app) {
  console.log(`  Building static app: ${app.dirName}`);
  const outDir = path.join(DIST_CLIENT, 'apps', app.dirName);
  const result = spawnSync('pnpm', ['--filter', app.packageName, 'build'], {
    cwd: LAB_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      LAB_APP_BASE: `/apps/${app.dirName}/`,
      LAB_APP_OUT_DIR: outDir,
    },
  });
  if (result.status !== 0) {
    throw new Error(`Build failed for static app: ${app.dirName}`);
  }
}

function buildFullstackApp(app) {
  console.log(`  Building fullstack app: ${app.dirName} (${app.framework})`);
  // Each fullstack app builds into its own apps/<slug>/dist/.
  // wrangler deploy --config apps/<slug>/wrangler.jsonc picks it up later.
  const result = spawnSync('pnpm', ['--filter', app.packageName, 'build'], {
    cwd: LAB_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Build failed for fullstack app: ${app.dirName}`);
  }
}

function bindingNameForSlug(slug) {
  return `APP_${slug.toUpperCase().replace(/-/g, '_')}`;
}

function writeRootWranglerConfig({ fullstackApps }) {
  const templatePath = path.join(SERVER_DIR, 'wrangler.jsonc');
  const generatedPath = path.join(SERVER_DIR, 'wrangler.generated.jsonc');
  const template = fs.readFileSync(templatePath, 'utf8');

  const services = fullstackApps.map((app) => ({
    binding: bindingNameForSlug(app.dirName),
    service: `${LAB_NAME}-${app.dirName}`,
  }));

  const generated = template.replace(
    /"__LAB_FULLSTACK_SERVICES__"/,
    JSON.stringify(services),
  );

  // Catch any stray placeholders so deploys fail fast with a useful message
  // instead of wrangler emitting a confusing schema error.
  const stray = generated.match(/__[A-Z_]+__/);
  if (stray) {
    throw new Error(
      `server/wrangler.jsonc still contains placeholder ${stray[0]}. ` +
      `Run create-lab.mjs (for a fresh lab) or fix the template before building.`,
    );
  }

  fs.writeFileSync(generatedPath, generated);
  console.log(`  Wrote server/wrangler.generated.jsonc (${services.length} service binding(s))`);
}

function buildRootWorker() {
  console.log(`  Building root Worker`);
  // Use esbuild via the server package's build script
  const result = spawnSync('pnpm', ['--filter', '@lab/server', 'build'], {
    cwd: LAB_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Build failed for root Worker');
  }
}

// ════════════════════════════════════════════════════════════════
// Landing page
// ════════════════════════════════════════════════════════════════

function writeLandingPage({ pages, staticApps, fullstackApps }) {
  const buildDate = new Date().toISOString().slice(0, 10);
  const totalCount = pages.length + staticApps.length + fullstackApps.length;
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(LAB_NAME)}</title>
  <style>
    /* Auto-generated lab index.
       Intentionally neutral / system-flavored — apps live below this page and
       carry their own brand via apps/<slug>/DESIGN.md. The lab itself is the
       table of contents, not a brand. */
    :root {
      --bg: #ffffff;
      --fg: #111111;
      --fg-muted: #666666;
      --fg-soft: #999999;
      --border: #e5e5e5;
      --link: #0061d5;
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0e0e10;
        --fg: #f1f1f1;
        --fg-muted: #a0a0a5;
        --fg-soft: #6e6e75;
        --border: #2a2a2d;
        --link: #4ea1ff;
      }
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--mono);
      font-size: 14px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    main {
      max-width: 720px;
      margin: clamp(40px, 6vw, 72px) auto;
      padding: 0 clamp(20px, 4vw, 28px);
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .header h1 {
      font-family: var(--mono);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0;
    }
    .header .meta {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--fg-soft);
    }
    .lede {
      font-family: var(--sans);
      font-size: 13px;
      color: var(--fg-muted);
      margin: 14px 0 28px;
      line-height: 1.6;
    }
    section { margin-top: 28px; }
    h2 {
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--fg-soft);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    table { width: 100%; border-collapse: collapse; }
    tbody tr { border-top: 1px solid var(--border); }
    tbody tr:last-child { border-bottom: 1px solid var(--border); }
    td {
      padding: 8px 12px 8px 0;
      vertical-align: baseline;
      font-family: var(--mono);
      font-size: 13px;
    }
    td.name { width: 100%; }
    td.name a { color: var(--fg); text-decoration: none; }
    td.name a:hover { color: var(--link); text-decoration: underline; text-underline-offset: 3px; }
    td.kind {
      color: var(--fg-soft);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
      text-align: right;
    }
    td.kind .example {
      color: var(--fg-muted);
      margin-left: 6px;
      font-style: italic;
      text-transform: none;
      letter-spacing: 0;
    }
    .empty {
      font-family: var(--sans);
      font-size: 13px;
      color: var(--fg-soft);
      font-style: italic;
      padding: 12px 0;
    }
    footer {
      margin-top: 40px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      font-family: var(--mono);
      font-size: 11px;
      color: var(--fg-soft);
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    footer a { color: var(--fg-soft); text-decoration: none; }
    footer a:hover { color: var(--link); }
  </style>
</head>
<body>
  <main>
    <div class="header">
      <h1>${escapeHtml(LAB_NAME)}/</h1>
      <span class="meta">${totalCount} item${totalCount === 1 ? '' : 's'}</span>
    </div>
    <p class="lede">Index of pages and apps in this lab. Each app carries its own brand via <code>apps/&lt;slug&gt;/DESIGN.md</code>; this page is just the directory.</p>

    ${renderSection('pages/', pages.map((p) => ({ name: p.slug, href: `/pages/${p.file}`, kind: 'html', isExample: p.isExample })))}
    ${renderSection('apps/ — static', staticApps.map((a) => ({ name: a.dirName, href: `/apps/${a.dirName}/`, kind: a.framework || 'static' })))}
    ${renderSection('apps/ — fullstack', fullstackApps.map((a) => ({ name: a.dirName, href: `/apps/${a.dirName}/`, kind: a.framework })))}

    <footer>
      <span>built ${buildDate}</span>
      <a href="/status">/status</a>
    </footer>
  </main>
</body>
</html>`;
  fs.writeFileSync(path.join(DIST_CLIENT, 'index.html'), html);
}

function renderSection(title, items) {
  if (!items.length) return '';
  return `<section><h2>${escapeHtml(title)}</h2><table><tbody>` +
    items.map((i) => {
      const exampleTag = i.isExample ? '<span class="example">starter example</span>' : '';
      return `<tr><td class="name"><a href="${i.href}">${escapeHtml(i.name)}</a></td><td class="kind">${escapeHtml(i.kind || '')}${exampleTag}</td></tr>`;
    }).join('') +
    '</tbody></table></section>';
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function copyDir(src, dst) {
  mkdirp(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) copyFile(s, d);
  }
}
function copyFile(src, dst) {
  mkdirp(path.dirname(dst));
  fs.copyFileSync(src, dst);
}
function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  mkdirp(dir);
}
function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
