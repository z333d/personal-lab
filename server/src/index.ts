/**
 * Root Worker for the lab.
 *
 * Responsibilities:
 *   • Serve static assets (HTML pages and static React app builds) via the
 *     ASSETS binding configured in wrangler.jsonc.
 *   • Provide a small landing page at "/" that lists everything in the lab.
 *   • Optionally proxy /apps/<slug>/* paths to per-app fullstack Workers.
 *     (In production we use Cloudflare Workers Routes for this, so the request
 *     never reaches this Worker. The proxy here is a dev-mode fallback.)
 */
import { Hono } from 'hono';

interface Env {
  ASSETS: Fetcher;
  // Lab metadata injected at build time by build-lab.mjs.
  LAB_NAME?: string;
  LAB_MANIFEST?: string;  // JSON string of { pages, staticApps, fullstackApps }
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// Lab status (deployment metadata)
app.get('/status', (c) => {
  const manifest = c.env.LAB_MANIFEST ? JSON.parse(c.env.LAB_MANIFEST) : null;
  return c.json({
    lab: c.env.LAB_NAME ?? 'unknown',
    manifest,
    rootWorker: { ok: true, ts: Date.now() },
  });
});

// Default fallback: hand off to static assets binding (which serves index.html
// for "/" and the matching file for everything else, with SPA-style fallback
// for /apps/<slug>/*).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
