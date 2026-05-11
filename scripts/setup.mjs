#!/usr/bin/env node
/**
 * setup.mjs — first-time configuration wizard.
 *
 * Verifies wrangler + gh logins and writes ~/.config/create-pages-site/config.json
 * with defaults the orchestrator needs (GitHub org, projects dir, default zone).
 *
 * No secrets are stored — the wrangler login + gh login already handle credentials
 * for those services. We only persist non-secret defaults.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'create-pages-site');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const rl = readline.createInterface({ input, output });
const ask = (q, def) => rl.question(def !== undefined && def !== '' ? `${q} [${def}]: ` : `${q}: `).then((a) => a.trim() || def || '');

function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function step(msg) { console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`); }
function err(msg) { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); }

console.log('🔧 create-pages-site setup\n');

const existing = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};

// ── 1. GitHub ──
step('GitHub');
const ghCheck = spawnSync('gh', ['auth', 'status'], { stdio: 'pipe' });
if (ghCheck.status !== 0) {
  err('gh CLI not authenticated. Run `gh auth login` first.');
  process.exit(1);
}
const ghUserOut = spawnSync('gh', ['api', 'user', '--jq', '.login'], { stdio: ['ignore', 'pipe', 'inherit'] });
const ghUser = ghUserOut.stdout.toString().trim();
ok(`gh logged in as ${ghUser}`);
const githubOrg = await ask('  GitHub owner (user or org) for new repos', existing.githubOrg || ghUser);

// ── 2. Wrangler / Cloudflare ──
step('Cloudflare (via wrangler)');
const wrCheck = spawnSync('npx', ['wrangler', 'whoami'], { stdio: 'pipe' });
const wrOut = wrCheck.stdout.toString();
if (wrCheck.status !== 0 || !wrOut.includes('@')) {
  err('wrangler not authenticated. Run `npx wrangler login` first.');
  process.exit(1);
}
// Extract email + account ID
const emailMatch = wrOut.match(/You are logged in[^\n]*?with the email\s+([^\s]+?)\.?(?=[\s,.\n]|$)/i);
const email = emailMatch ? emailMatch[1] : '(unknown)';
ok(`wrangler logged in as ${email}`);

// List zones using wrangler — alas wrangler doesn't have a "list zones" command,
// but it does set CLOUDFLARE_API_TOKEN env when running. We skip auto-discovery
// and just ask the user for default domain (or empty for workers.dev).
console.log('');
console.log('  Choose your default lab URL pattern:');
console.log('    1. <lab>.<your-cloudflare-zone>     (e.g. my-app.example.com)');
console.log('    2. <lab>.<account>.workers.dev      (Cloudflare free subdomain, zero setup)');
const zoneChoice = await ask('  >', existing.defaultZone ? '1' : '2');

let defaultZone = '';
if (zoneChoice === '1' || zoneChoice.includes('.')) {
  defaultZone = await ask('  Enter your Cloudflare zone (e.g. example.com)', existing.defaultZone);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(defaultZone)) {
    err(`Invalid zone: ${defaultZone}`);
    process.exit(1);
  }
  ok(`default lab URL pattern: <lab>.${defaultZone}`);
} else {
  ok('default: workers.dev free subdomain');
}

// ── 3. Local projects directory ──
step('Local projects directory');
const projectsDir = await ask('  Where to clone new labs?', existing.projectsDir || '~/projects/playground');

// ── Save ──
fs.mkdirSync(CONFIG_DIR, { recursive: true });
const config = {
  githubOrg,
  projectsDir,
  defaultZone: defaultZone || null,
  cloudflareEmail: email,
};
fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
fs.chmodSync(CONFIG_PATH, 0o600);

console.log('');
ok(`Config saved to ${CONFIG_PATH}`);
console.log('');
console.log('Next: ask the assistant — "建个 lab 叫 my-test-lab"');
console.log('     or run: node ' + path.basename(import.meta.url.replace(/setup\.mjs$/, 'create-lab.mjs')) + ' my-test-lab');

rl.close();
