#!/usr/bin/env node
/**
 * deploy-all.mjs — deploy every Worker in this lab.
 *
 * Order matters: fullstack Workers are deployed first so the root Worker's
 * service bindings can target services that already exist. (Wrangler will
 * accept bindings to missing services with a warning, but the binding does
 * not work until the target exists. Deploying in this order avoids that
 * transient broken state.)
 *
 * Assumes:
 *   • `pnpm build` has run (so dist/ and apps/<slug>/dist/ are up to date).
 *   • wrangler is authenticated (`npx wrangler whoami`).
 *   • Each fullstack app's wrangler.jsonc has a real `database_id`
 *     (create-lab.mjs sets this; for apps added later, run
 *     `npx wrangler d1 create <lab>-<slug>` first and paste the id in).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB_ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.join(LAB_ROOT, 'apps');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

// Discover fullstack apps
const fullstackApps = [];
if (fs.existsSync(APPS_DIR)) {
  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const pkgPath = path.join(APPS_DIR, entry.name, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.lab?.fullstack) {
      fullstackApps.push({ slug: entry.name, dir: path.join(APPS_DIR, entry.name) });
    }
  }
}

console.log(`\n▸ Deploying ${fullstackApps.length} fullstack app(s) first, then root Worker.\n`);

for (const app of fullstackApps) {
  console.log(`▸ Deploy ${app.slug}`);
  // Refuse to deploy with the placeholder DB id — that would silently bind to
  // nothing and confuse the auth flow at runtime.
  const wf = path.join(app.dir, 'wrangler.jsonc');
  const wfText = fs.readFileSync(wf, 'utf8');
  if (wfText.includes(`__D1_${app.slug.toUpperCase().replace(/-/g, '_')}_ID__`)) {
    throw new Error(
      `apps/${app.slug}/wrangler.jsonc still has the D1 placeholder. ` +
      `Run \`npx wrangler d1 create <lab>-${app.slug}\` from this app's directory and ` +
      `paste the returned database_id into wrangler.jsonc before deploying.`,
    );
  }
  run('npx', ['wrangler', 'deploy'], { cwd: app.dir });
}

console.log(`\n▸ Deploy root Worker`);
const rootConfig = path.join(LAB_ROOT, 'server', 'wrangler.generated.jsonc');
const useGenerated = fs.existsSync(rootConfig);
run(
  'npx',
  ['wrangler', 'deploy', '--config', useGenerated ? 'server/wrangler.generated.jsonc' : 'server/wrangler.jsonc'],
  { cwd: LAB_ROOT },
);

console.log(`\n✓ All Workers deployed.\n`);
