import { useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from './components/ui/button';
import { cn } from './lib/cn';

const STORAGE_KEY = 'counter:value';

export function App() {
  const [count, setCount] = useState(() => {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(count));
  }, [count]);

  function bump(delta: number) {
    setCount((c) => c + delta);
    setPulse(true);
    setTimeout(() => setPulse(false), 120);
  }

  return (
    <main className="min-h-screen bg-surface text-fg">
      <div className="max-w-xl mx-auto py-16 px-6 flex flex-col gap-8">
        {/* Header — system message */}
        <header className="flex flex-col gap-2 border-b border-border pb-6">
          <p className="text-caption uppercase tracking-wider text-accent">$ counter --persist</p>
          <h1 className="font-display text-display text-fg">Counter</h1>
          <p className="text-body-sm text-fg-muted">
            Static React. State persists via <span className="text-accent">localStorage</span>.
            No backend, no database, no login.
          </p>
        </header>

        {/* Status line */}
        <div className="flex items-center gap-3 text-caption uppercase tracking-wider">
          <span className="inline-block w-2 h-2 rounded-full bg-success" />
          <span className="text-fg-muted">READY</span>
          <span className="text-fg-soft">·</span>
          <span className="text-fg-soft">val={count}</span>
        </div>

        {/* Counter display — big mono number with bracket framing */}
        <div className="border border-border bg-surface-2 rounded-md p-8 flex flex-col gap-6">
          <div className="flex items-baseline justify-between text-caption uppercase tracking-wider text-fg-soft">
            <span>// value</span>
            <span>i32</span>
          </div>
          <div className="flex items-center justify-center gap-6">
            <span className="text-fg-soft text-3xl select-none">[</span>
            <span
              className={cn(
                'font-display text-fg tabular-nums transition-colors duration-100',
                pulse && 'text-accent'
              )}
              style={{ fontSize: 80, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}
            >
              {count}
            </span>
            <span className="text-fg-soft text-3xl select-none">]</span>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" size="lg" onClick={() => bump(-1)} aria-label="decrement">
              <Minus className="h-4 w-4" />
              <span>dec</span>
            </Button>
            <Button variant="accent" size="lg" onClick={() => bump(1)} aria-label="increment">
              <Plus className="h-4 w-4" />
              <span>inc</span>
            </Button>
          </div>
        </div>

        {/* Reset + footnote */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setCount(0)}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-caption uppercase tracking-wider">reset</span>
          </Button>
          <span className="text-caption uppercase tracking-wider text-fg-soft">
            apps/counter/src/App.tsx
          </span>
        </div>

        {/* Footer comment */}
        <pre className="text-body-sm text-fg-soft border-t border-border pt-6 leading-relaxed whitespace-pre-wrap">
{`# Edit apps/counter/src/App.tsx to make it yours.
# Or copy the folder to apps/<your-name>/ as a starting point.
# Theme: DESIGN.md → pnpm theme:gen → Tailwind v4`}
        </pre>
      </div>
    </main>
  );
}
