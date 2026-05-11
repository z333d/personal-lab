/**
 * Todo app — Hono Worker.
 *
 * Mounts:
 *   /apps/todo/api/auth/*  → Better Auth handler (sign-in / sign-up / session)
 *   /apps/todo/api/me      → current user
 *   /apps/todo/api/todos   → list / create / delete (per-user)
 *   /apps/todo/*           → static SPA via ASSETS binding
 */
import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { createAppAuth, getDb, type AuthEnv } from '@lab/lib';
import { schema, todos } from '../../shared/schema';

type Env = AuthEnv & {
  ASSETS: Fetcher;
};

type Variables = {
  user: { id: string; email: string; name: string } | null;
  session: { id: string; userId: string } | null;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ────────── Auth handler (mounts /api/auth/*) ──────────
app.on(['GET', 'POST'], '/apps/todo/api/auth/*', (c) => {
  const auth = createAppAuth(c.env, schema);
  return auth.handler(c.req.raw);
});

// ────────── Session middleware ──────────
app.use('/apps/todo/api/*', async (c, next) => {
  const auth = createAppAuth(c.env, schema);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', (session?.user as Variables['user']) ?? null);
  c.set('session', (session?.session as Variables['session']) ?? null);
  await next();
});

// ────────── Helpers ──────────
function requireUser(c: any) {
  const user = c.get('user');
  if (!user) {
    return null;
  }
  return user as { id: string; email: string; name: string };
}

// ────────── Routes ──────────
app.get('/apps/todo/api/me', (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
});

app.get('/apps/todo/api/todos', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const db = getDb(c.env, schema);
  const items = await db.select().from(todos).where(eq(todos.userId, user.id)).orderBy(desc(todos.createdAt));
  return c.json({ items });
});

app.post('/apps/todo/api/todos', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const body = await c.req.json<{ title?: string }>();
  const title = (body?.title || '').trim();
  if (!title) return c.json({ error: 'title required' }, 400);
  const db = getDb(c.env, schema);
  const id = crypto.randomUUID();
  await db.insert(todos).values({ id, userId: user.id, title, done: false });
  return c.json({ id });
});

app.patch('/apps/todo/api/todos/:id', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json<{ done?: boolean; title?: string }>();
  const db = getDb(c.env, schema);
  await db.update(todos)
    .set({ ...(typeof body.done === 'boolean' ? { done: body.done } : {}), ...(body.title ? { title: body.title } : {}) })
    .where(eq(todos.id, id));
  return c.json({ ok: true });
});

app.delete('/apps/todo/api/todos/:id', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const db = getDb(c.env, schema);
  await db.delete(todos).where(eq(todos.id, id));
  return c.json({ ok: true });
});

// Health check
app.get('/apps/todo/api/health', (c) => c.json({ ok: true, app: 'todo' }));

export default app;
