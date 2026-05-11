/**
 * Root Worker for the lab.
 *
 * Responsibilities:
 *   • Dispatch /apps/<slug>/* to the per-app fullstack Worker via a Service
 *     Binding when one is configured (see scripts/build-lab.mjs, which injects
 *     them into server/wrangler.jsonc.generated based on discovered apps).
 *   • Otherwise, serve static assets (HTML pages, static React app builds, and
 *     the auto-generated lab landing) via the ASSETS binding.
 *
 * With custom-domain Workers Routes the per-app routes intercept the request
 * before it reaches this Worker, so the Service Binding branch is the
 * workers.dev fallback path — but it works equally well in both modes.
 */
import { Hono } from 'hono';

type Bindings = {
  ASSETS: Fetcher;
  LAB_NAME?: string;
  LAB_MANIFEST?: string;
  // Per-app fullstack bindings: APP_TODO, APP_DEMO_FULL, … (injected via
  // server/wrangler.jsonc.generated). Looked up dynamically below.
  [key: string]: unknown;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.get('/status', (c) => {
  const manifest = c.env.LAB_MANIFEST ? JSON.parse(c.env.LAB_MANIFEST as string) : null;
  return c.json({
    lab: c.env.LAB_NAME ?? 'unknown',
    manifest,
    rootWorker: { ok: true, ts: Date.now() },
  });
});

function bindingNameForSlug(slug: string) {
  return `APP_${slug.toUpperCase().replace(/-/g, '_')}`;
}

// Dispatch /apps/<slug>/* to the matching fullstack Worker if a service
// binding exists. The binding name is APP_<SLUG_UPPER_WITH_UNDERSCORES>.
app.all('/apps/:slug/*', async (c, next) => {
  const slug = c.req.param('slug');
  const binding = c.env[bindingNameForSlug(slug)] as Fetcher | undefined;
  if (binding && typeof binding.fetch === 'function') {
    return binding.fetch(c.req.raw);
  }
  return next();
});

// Fallback: serve static assets (also handles /, /pages/*, /apps/<static>/*).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
