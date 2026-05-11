#!/usr/bin/env node
/**
 * Reads DESIGN.md and emits src/theme.generated.css with a Tailwind v4
 * @theme block. Runs before vite build/dev so `@import "tailwindcss"` picks
 * up the brand tokens automatically.
 *
 * Usage:
 *   node scripts/gen-theme.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const DESIGN = path.join(APP_ROOT, 'DESIGN.md');
const OUT = path.join(APP_ROOT, 'src/theme.generated.css');

if (!fs.existsSync(DESIGN)) {
  console.error(`✗ DESIGN.md not found at ${DESIGN}`);
  process.exit(1);
}

// Run design.md export → tailwind v3-style JSON
const result = spawnSync('npx', ['--yes', '@google/design.md', 'export', DESIGN, '--format', 'tailwind'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (result.status !== 0) {
  console.error('✗ design.md export failed');
  process.exit(1);
}
const config = JSON.parse(result.stdout.toString());
const extend = config.theme?.extend ?? {};

// Convert to Tailwind v4 @theme block
const lines = ['/* Auto-generated from DESIGN.md by scripts/gen-theme.mjs. Do not edit. */', '', '@theme {'];

// Colors → --color-*
for (const [name, value] of Object.entries(extend.colors || {})) {
  lines.push(`  --color-${name}: ${value};`);
}

// NOTE: We intentionally do NOT emit --spacing-* from DESIGN.md.
// Tailwind v4's `--spacing-<key>` namespace collides with named utilities like
// `max-w-md`, `max-w-xl`, etc., so emitting `--spacing-xl: 24px` would silently
// remap `max-w-xl` from 36rem to 24px and break layouts.
// DESIGN.md's spacing scale is documentation for humans/agents — use Tailwind's
// numeric utilities (gap-4 = 16px ≈ "lg") and leave the default scale alone.
// Spacing values are still surfaced as --space-* for explicit reference.
for (const [name, value] of Object.entries(extend.spacing || {})) {
  lines.push(`  --space-${name}: ${typeof value === 'number' ? value + 'px' : value};`);
}

// Border radius → --radius-*
for (const [name, value] of Object.entries(extend.borderRadius || {})) {
  lines.push(`  --radius-${name}: ${value};`);
}

// Font families → --font-*
for (const [name, value] of Object.entries(extend.fontFamily || {})) {
  const family = Array.isArray(value) ? value.join(', ') : value;
  lines.push(`  --font-${name}: ${family};`);
}

// Font sizes (Tailwind v3 array format: [size, options])
for (const [name, value] of Object.entries(extend.fontSize || {})) {
  if (Array.isArray(value)) {
    const [size, opts = {}] = value;
    lines.push(`  --text-${name}: ${size};`);
    if (opts.lineHeight) lines.push(`  --text-${name}--line-height: ${opts.lineHeight};`);
    if (opts.fontWeight) lines.push(`  --text-${name}--font-weight: ${opts.fontWeight};`);
    if (opts.letterSpacing) lines.push(`  --text-${name}--letter-spacing: ${opts.letterSpacing};`);
  } else {
    lines.push(`  --text-${name}: ${value};`);
  }
}

lines.push('}', '');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`✓ Generated ${path.relative(APP_ROOT, OUT)} from DESIGN.md`);
