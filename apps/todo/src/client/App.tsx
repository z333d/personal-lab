import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { authClient } from './auth-client';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import { cn } from './lib/cn';

const API = '/apps/todo/api';

type User = { id: string; email: string; name: string };
type Todo = { id: string; userId: string; title: string; done: boolean; createdAt: number };

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/me`);
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
        <p className="text-fg-soft italic font-caption">loading…</p>
      </main>
    );
  }
  if (!user) return <AuthForm onAuth={refreshMe} />;
  return <TodoList user={user} onSignOut={async () => { await authClient.signOut(); refreshMe(); }} />;
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
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-caption italic text-accent tracking-wide">— Notebook</p>
        <h1 className="font-display text-display text-fg">Todo</h1>
        <p className="font-caption italic text-body-sm text-fg-muted">A quiet place for your day's small things.</p>
      </header>

      <div className="flex items-baseline gap-3 text-body-sm">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={cn(
            'transition-colors',
            mode === 'signin' ? 'text-accent font-medium' : 'text-fg-muted hover:text-fg'
          )}
        >
          Sign in
        </button>
        <span className="text-fg-soft">·</span>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={cn(
            'transition-colors',
            mode === 'signup' ? 'text-accent font-medium' : 'text-fg-muted hover:text-fg'
          )}
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
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>
        <Button type="submit" variant="accent" disabled={submitting} className="mt-2">
          {submitting ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
        {err && <p className="text-body-sm text-danger">{err}</p>}
      </form>
    </main>
  );
}

function TodoList({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [items, setItems] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`${API}/todos`);
    if (res.ok) {
      const data = (await res.json()) as { items: Todo[] };
      setItems(data.items);
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await fetch(`${API}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.trim() }),
      });
      setDraft('');
      await load();
    } finally { setBusy(false); }
  }

  async function toggle(t: Todo) {
    await fetch(`${API}/todos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !t.done }),
    });
    load();
  }
  async function remove(t: Todo) {
    await fetch(`${API}/todos/${t.id}`, { method: 'DELETE' });
    load();
  }

  const remaining = items.filter((t) => !t.done).length;

  return (
    <main className="max-w-md mx-auto py-16 px-6 flex flex-col gap-6">
      <header className="flex items-baseline justify-between border-b border-border pb-4">
        <div>
          <p className="text-caption italic text-accent tracking-wide">— Notebook</p>
          <h1 className="font-display text-h1 text-fg">Todo</h1>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-body-sm text-fg-muted">{user.email}</span>
          <Button variant="link" size="sm" onClick={onSignOut} className="text-fg-soft hover:text-fg">
            sign out
          </Button>
        </div>
      </header>

      <form onSubmit={add} className="flex gap-2">
        <Input
          placeholder="add a todo…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" variant="accent" disabled={busy || !draft.trim()}>
          add
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="font-caption italic text-fg-muted py-6">No todos yet — add one above.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((t) => (
            <li
              key={t.id}
              className={cn(
                'flex items-center gap-4 py-3 border-b border-border last:border-b-0 group transition-colors',
                t.done && 'opacity-60'
              )}
            >
              <Checkbox checked={t.done} onCheckedChange={() => toggle(t)} />
              <span className={cn('flex-1 text-body', t.done && 'line-through text-fg-muted')}>
                {t.title}
              </span>
              <button
                onClick={() => remove(t)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-soft hover:text-danger p-1 rounded"
                aria-label="delete"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <p className="font-caption italic text-fg-soft text-center pt-2">
          {remaining === 0 ? 'all clear · go outside' : `${remaining} ${remaining === 1 ? 'thing' : 'things'} to do`}
        </p>
      )}
    </main>
  );
}
