# DESIGN.md Showcase

Three drop-in DESIGN.md examples showing how the same fullstack-app template (todo) takes on completely different visual identities just by swapping this file.

| Variant | Vibe | Best for |
|---|---|---|
| [01-notebook.md](./01-notebook.md) | Quiet editorial. Cream paper + serif headlines + warm terracotta accent. | Personal apps, journaling, reading lists. |
| [02-terminal.md](./02-terminal.md) | Hacker / IDE. Mono everywhere, dark blue-black + electric lime accent. | Dev tools, internal dashboards, command palettes. |
| [03-postcard.md](./03-postcard.md) | Bold, playful, casual. Cream + deep teal + chunky coral serif display. | Friendly social apps, casual check-ins. |

## Trying one

```bash
# Inside an existing fullstack app:
cp /path/to/02-terminal.md apps/<slug>/DESIGN.md
pnpm theme:gen     # regenerates the Tailwind theme
pnpm dev           # see the new look
```

The shadcn components (Button, Input, Label, Checkbox) all reference brand tokens (`bg-accent`, `text-fg`, `border-border`, etc.), so they automatically pick up the new theme — no component changes needed.

## Writing your own

Start from one of these as a base. Edit the YAML front matter (colors, typography, spacing, rounded). The Markdown body is just for human / agent context — it doesn't generate code, but it tells future contributors and AI agents *why* the choices were made.

The `name` field doesn't have to be one of "Notebook" / "Terminal" / "Postcard" — pick anything that captures the vibe.

## Validation

```bash
npx @google/design.md lint apps/<slug>/DESIGN.md
```

Catches structural issues (broken token references, contrast problems).
