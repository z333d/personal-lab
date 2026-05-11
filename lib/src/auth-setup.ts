/**
 * Better Auth factory for a fullstack app.
 *
 * Each app's request handler calls `createAppAuth(env, schema, options)` to get
 * a configured Better Auth instance. The instance:
 *   • uses this app's D1 binding (env.DB)
 *   • uses this app's secret (env.BETTER_AUTH_SECRET)
 *   • scopes cookies to the app's path (`/apps/<slug>/`) to prevent cross-app session bleed
 *   • supports email/password by default; social providers can be enabled in options
 *   • uses PBKDF2 (Web Crypto) for password hashing to fit Cloudflare Workers
 *     free-tier 10ms CPU/request limit. Better Auth's default scrypt would
 *     intermittently 503 on Workers free; PBKDF2 with 10k iters runs ~3-4ms.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './db';

// ────────── PBKDF2 password hashing (Workers-friendly) ──────────
// Format: pbkdf2$<iters>$<salt-base64>$<hash-base64>

const PBKDF2_ITERS = 10000;  // ~3-4ms on Workers; safer than plain hash
const PBKDF2_HASH_BITS = 256;
const PBKDF2_SALT_BYTES = 16;

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    // Cast salt to BufferSource (deriveBits accepts ArrayBuffer or TypedArray)
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: iters, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_HASH_BITS
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

async function verifyPassword({ password, hash: stored }: { password: string; hash: string }): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iters = parseInt(parts[1], 10);
  if (!Number.isFinite(iters) || iters < 1000 || iters > 1_000_000) return false;
  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);
  const actual = await pbkdf2(password, salt, iters);
  if (actual.length !== expected.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  /** Path prefix for cookie scope, e.g. `/apps/todo` */
  APP_BASE_PATH: string;
}

export interface CreateAppAuthOptions {
  /** Disable email/password login (default: enabled). */
  emailAndPassword?: boolean;
  /**
   * Optional social providers. Pass undefined to disable; pass an object to enable.
   * The skill leaves these off by default; users opt in by adding secrets later.
   */
  socialProviders?: Record<string, { clientId: string; clientSecret: string }>;
}

export function createAppAuth<TSchema extends Record<string, unknown>>(
  env: AuthEnv,
  schema: TSchema,
  options: CreateAppAuthOptions = {}
) {
  const db = getDb(env, schema);
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: `${env.APP_BASE_PATH}/api/auth`,
    emailAndPassword: {
      enabled: options.emailAndPassword !== false,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    advanced: {
      cookies: {
        path: env.APP_BASE_PATH,
      },
    },
    ...(options.socialProviders ? { socialProviders: options.socialProviders } : {}),
  });
}

export type Auth = ReturnType<typeof createAppAuth>;
