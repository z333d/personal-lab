#!/usr/bin/env node
/**
 * create-lab.mjs — create a new lab from this template.
 *
 * Usage:
 *   node create-lab.mjs <lab-name> [options]
 *
 * Options:
 *   --no-deploy        Skip Cloudflare deploy (just clone + push to GitHub).
 *   --no-domain        Use workers.dev instead of custom subdomain.
 *   --domain <host>    Override the custom subdomain (e.g. my.example.com).
 *   --org <github>     Override default GitHub org/user.
 *   --keep-on-fail     Don't clean up partial state if a step fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The template is the directory ABOVE the scripts/ dir of this file
// (scripts/ lives inside the template).
const TEMPLATE_ROOT = path.resolve(__dirname, '..');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'create-pages-site');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// ────────── Logger ──────────
const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const step = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
const fail = (msg) => { console.error(`\x1b[31m✗ ${msg}\x1b[0m`); process.exit(1); };

// ────────── Parse args ──────────
const args = process.argv.slice(2);
const flags = new Set();
const opts = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--no-deploy' || a === '--no-domain' || a === '--keep-on-fail') flags.add(a);
  else if (a === '--domain' || a === '--org') { opts[a.slice(2)] = args[++i]; }
  else if (a.startsWith('--')) fail(`Unknown flag: ${a}`);
  else positional.push(a);
}
const labName = positional[0];

if (!labName || !/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(labName)) {
  fail('Lab name required (3–40 chars, lowercase letters/digits/hyphens, starts with a letter).\nUsage: node create-lab.mjs <lab-name> [--no-deploy] [--no-domain] [--domain <host>] [--org <gh-owner>]');
}

// ────────── Load config ──────────
if (!fs.existsSync(CONFIG_PATH)) {
  fail(`Config not found at ${CONFIG_PATH}\nRun: node setup.mjs`);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const githubOrg = opts.org || cfg.githubOrg;
const projectsDir = cfg.projectsDir.replace(/^~/, os.homedir());
const useCustomDomain = !flags.has('--no-domain') && !!cfg.defaultZone;
const customDomain = opts.domain || (useCustomDomain ? `${labName}.${cfg.defaultZone}` : null);
const skipDeploy = flags.has('--no-deploy');

const labDir = path.join(projectsDir, labName);
const labRepoUrl = `github.com/${githubOrg}/${labName}`;
const labWorkerName = labName;
const finalUrl = customDomain ? `https://${customDomain}` : `https://${labName}.<account>.workers.dev`;

// ────────── Pre-flight ──────────
if (fs.existsSync(labDir)) {
  fail(`Directory already exists: ${labDir}`);
}
const gh = spawnSync('gh', ['auth', 'status'], { stdio: 'pipe' });
if (gh.status !== 0) fail('gh not authenticated. Run `gh auth login`.');
const wr = spawnSync('npx', ['wrangler', 'whoami'], { stdio: 'pipe' });
if (wr.status !== 0) fail('wrangler not authenticated. Run `npx wrangler login`.');

log(`\nCreating lab: \x1b[1m${labName}\x1b[0m`);
log(`  Local:  ${labDir}`);
log(`  Repo:   ${labRepoUrl}`);
log(`  URL:    ${finalUrl}`);
if (skipDeploy) log(`  (skipping Cloudflare deploy)`);
log('');

// State for cleanup on failure
const cleanupActions = [];
let succeeded = false;

process.on('exit', () => {
  if (!succeeded && !flags.has('--keep-on-fail') && cleanupActions.length) {
    console.error('\nA step failed. Cleaning up partial state…');
    for (const action of cleanupActions.reverse()) {
      try { action(); } catch (e) { console.error('  cleanup error:', e.message); }
    }
    console.error('Run with --keep-on-fail to inspect partial state next time.');
  }
});

// ────────── 1. Copy template ──────────
step('Copy template');
copyDir(TEMPLATE_ROOT, labDir, /* skip */ ['node_modules', 'dist', '.git', '.wrangler', '.DS_Store']);
substituteInDir(labDir, '__LAB_NAME__', labName);

// Substitute route placeholders. If we have a custom domain, set up routes;
// otherwise use null (workers.dev URL only).
// wrangler 4 rejects `"routes": null`; use an empty array when no custom domain
// (workers_dev still defaults to true, so the *.workers.dev URL stays available).
const rootRoutesJson = customDomain
  ? JSON.stringify([{ pattern: customDomain, custom_domain: true }])
  : '[]';
substituteInDir(labDir, '"__LAB_ROOT_ROUTES__"', rootRoutesJson);

// Per-fullstack-app routes will be substituted after we discover them, below.
// Ensure CLAUDE.md is a symlink to AGENTS.md (in case fs.copyFile didn't preserve it)
try {
  const claudeMd = path.join(labDir, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) fs.unlinkSync(claudeMd);
  fs.symlinkSync('AGENTS.md', claudeMd);
} catch (e) { /* non-fatal */ }
cleanupActions.push(() => fs.rmSync(labDir, { recursive: true, force: true }));
ok(`template copied to ${labDir}`);

// ────────── 2. pnpm install ──────────
step('Install dependencies');
run('pnpm', ['install'], { cwd: labDir });
ok('dependencies installed');

// ────────── 3. Discover fullstack apps ──────────
const fullstackApps = [];
const appsDir = path.join(labDir, 'apps');
for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
  const pkgPath = path.join(appsDir, entry.name, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.lab?.fullstack) {
    fullstackApps.push({ slug: entry.name, dir: path.join(appsDir, entry.name), pkg });
  }
}
log(`  Found ${fullstackApps.length} fullstack app(s): ${fullstackApps.map(a => a.slug).join(', ') || '(none)'}`);

// Substitute per-app route placeholders
for (const app of fullstackApps) {
  const placeholder = `"__APP_${app.slug.toUpperCase()}_ROUTES__"`;
  const routesJson = customDomain
    ? JSON.stringify([{ pattern: `${customDomain}/apps/${app.slug}/*`, zone_name: cfg.defaultZone }])
    : '[]';
  substituteInFile(path.join(app.dir, 'wrangler.jsonc'), placeholder, routesJson);
}

// ────────── 4. Create D1 databases per fullstack app ──────────
if (skipDeploy) {
  log('\n--no-deploy set; skipping D1 creation, deploys, and DNS');
} else {
  for (const app of fullstackApps) {
    step(`Create D1 database for ${app.slug}`);
    const dbName = `${labName}-${app.slug}`;

    // Check if it already exists first (idempotent)
    let dbId = findExistingD1Id(app.dir, dbName);

    if (!dbId) {
      // Create it
      const create = spawnSync('npx', ['wrangler', 'd1', 'create', dbName], {
        cwd: app.dir,
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const out = create.stdout.toString();
      if (create.status !== 0) {
        throw new Error(`Failed to create D1 for ${app.slug}:\n${out}`);
      }
      // Wrangler prints a config snippet that includes database_id = "<uuid>"
      const idMatch = out.match(/database_id\s*=\s*"([^"]+)"|"database_id":\s*"([^"]+)"/);
      dbId = idMatch ? (idMatch[1] || idMatch[2]) : null;
      if (!dbId) {
        // Fallback: query the list
        dbId = findExistingD1Id(app.dir, dbName);
      }
      if (!dbId) {
        throw new Error(`Could not extract database_id for ${dbName}.\nWrangler output:\n${out}`);
      }
    } else {
      log(`  D1 ${dbName} already exists, reusing (id=${dbId})`);
    }

    substituteInFile(path.join(app.dir, 'wrangler.jsonc'), `__D1_${app.slug.toUpperCase()}_ID__`, dbId);
    cleanupActions.push(() => {
      try { spawnSync('npx', ['wrangler', 'd1', 'delete', dbName, '--skip-confirmation'], { cwd: app.dir, stdio: 'inherit' }); } catch {}
    });
    ok(`D1 ready: ${dbName} (id=${dbId})`);
  }

  // ────────── 5. Run migrations ──────────
  for (const app of fullstackApps) {
    step(`Apply migrations for ${app.slug}`);
    const migDir = path.join(app.dir, 'drizzle', 'migrations');
    if (!fs.existsSync(migDir)) {
      log(`  no migrations directory for ${app.slug}, skipping`);
      continue;
    }
    const sqlFiles = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
    for (const sql of sqlFiles) {
      run('npx', ['wrangler', 'd1', 'execute', `${labName}-${app.slug}`, '--remote', '--file', path.join(migDir, sql)], { cwd: app.dir });
    }
    ok(`migrations applied for ${app.slug}`);
  }

  // (Secrets are set AFTER Workers are deployed — see step 11.)
}

// ────────── 7. Build everything ──────────
step('Build');
run('pnpm', ['build'], { cwd: labDir });
ok('build succeeded');

// ────────── 8. git init + GitHub repo + push ──────────
step('Create GitHub repo + push');
run('git', ['init', '-b', 'main'], { cwd: labDir });
run('git', ['add', '-A'], { cwd: labDir });
run('git', ['commit', '-m', 'init: scaffold from create-pages-site'], { cwd: labDir });
const ghCreate = spawnSync('gh', ['repo', 'create', `${githubOrg}/${labName}`, '--private', '--source=.', '--push'], {
  cwd: labDir,
  stdio: 'inherit',
});
if (ghCreate.status !== 0) throw new Error('gh repo create failed');
cleanupActions.push(() => {
  log(`(would delete repo ${githubOrg}/${labName} — but skipping for safety; delete manually if needed)`);
});
ok(`pushed to github.com/${githubOrg}/${labName}`);

if (skipDeploy) {
  succeeded = true;
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  ok(`Done (no-deploy mode). Lab is on disk + GitHub.`);
  log(`  Local: ${labDir}`);
  log(`  Repo:  https://github.com/${githubOrg}/${labName}`);
  log(`\nTo deploy later: cd ${labDir} && pnpm deploy:all`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

// ────────── 9. Deploy each fullstack app's Worker FIRST ──────────
// (Must precede root deploy so root's service bindings target real services.)
for (const app of fullstackApps) {
  step(`Deploy ${app.slug} Worker (initial)`);
  run('npx', ['wrangler', 'deploy'], { cwd: app.dir });
  ok(`${app.slug} Worker deployed`);
}

// ────────── 10. Set secrets per fullstack app (Worker now exists) ──────────
for (const app of fullstackApps) {
  step(`Set secrets for ${app.slug}`);
  const secret = randomBytes(48).toString('base64url');
  // Better Auth expects baseURL = origin only. The path lives in basePath
  // (set in lib/auth-setup.ts via APP_BASE_PATH). When deployed without a
  // custom domain, traffic still arrives via the root Worker's hostname
  // (service-binding dispatch keeps the original request URL), so the origin
  // is the *root* Worker's, not the fullstack Worker's own workers.dev URL.
  const accountSub = cfg.cloudflareEmail?.split('@')[0] || 'account';
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `https://${labName}.${accountSub}.workers.dev`;
  setSecret(app.dir, 'BETTER_AUTH_SECRET', secret);
  setSecret(app.dir, 'BETTER_AUTH_URL', baseUrl);
  ok(`secrets set for ${app.slug}`);
}

// ────────── 11. Deploy root Worker (now its service bindings have real targets) ──────────
step('Deploy root Worker');
run('npx', ['wrangler', 'deploy', '--config', 'server/wrangler.generated.jsonc'], { cwd: labDir });
ok('root Worker deployed');

// Routes are declared in each Worker's wrangler.jsonc and applied automatically
// by `wrangler deploy`. No additional binding step needed here.
if (customDomain) {
  ok(`Custom domain ${customDomain} declared in routes; bound by wrangler deploy.`);
}

// ────────── Done ──────────
succeeded = true;
log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
ok(`✨ ${labName} is live!`);
log('');
log(`  Local:  ${labDir}`);
log(`  Repo:   https://github.com/${githubOrg}/${labName}`);
log(`  URL:    ${finalUrl}`);
log('');
log('Next steps:');
log(`  cd ${labDir}`);
log('  pnpm dev                # local dev (root + each fullstack app)');
log('  pnpm scaffold app foo   # add a new static app');
log('  pnpm scaffold app bar --fullstack   # add a new fullstack app');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
  return r;
}

function setSecret(cwd, name, value) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`wrangler secret put ${name} failed`);
}

function copyDir(src, dst, skip = []) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const sp = path.join(src, entry.name);
    const dp = path.join(dst, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(sp);
      try { fs.symlinkSync(target, dp); } catch { fs.copyFileSync(sp, dp); }
    } else if (entry.isDirectory()) {
      copyDir(sp, dp, skip);
    } else if (entry.isFile()) {
      fs.copyFileSync(sp, dp);
    }
  }
}

function substituteInDir(dir, find, replace) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      substituteInDir(p, find, replace);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const textExts = ['.ts', '.tsx', '.json', '.jsonc', '.html', '.md', '.css', '.js', '.mjs', '.cjs', '.yaml', '.yml'];
      if (textExts.includes(ext) || entry.name.startsWith('.')) {
        try {
          const before = fs.readFileSync(p, 'utf8');
          if (before.includes(find)) {
            fs.writeFileSync(p, before.split(find).join(replace));
          }
        } catch { /* binary */ }
      }
    }
  }
}

function substituteInFile(file, find, replace) {
  const content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, content.split(find).join(replace));
}

function findExistingD1Id(cwd, dbName) {
  // Try to use `wrangler d1 list --json` first; if --json isn't supported,
  // parse the table output.
  const tryJson = spawnSync('npx', ['wrangler', 'd1', 'list', '--json'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (tryJson.status === 0) {
    try {
      const list = JSON.parse(tryJson.stdout.toString());
      const found = list.find((d) => d.name === dbName);
      if (found) return found.uuid;
    } catch { /* fall through */ }
  }
  // Fallback: parse plain output for "<dbName>" + " <uuid>"
  const tryPlain = spawnSync('npx', ['wrangler', 'd1', 'list'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (tryPlain.status === 0) {
    const out = tryPlain.stdout.toString();
    // match a line containing dbName and a uuid
    const re = new RegExp(`\\b${dbName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^\\n]*?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})`);
    const m = out.match(re);
    if (m) return m[1];
  }
  return null;
}
