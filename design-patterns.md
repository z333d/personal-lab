# Design patterns

A vocabulary of aesthetic registers an agent can offer when helping someone build a page or app in this lab. Seven patterns, deliberately non-overlapping, each anchored to public design canon.

This file is **not** a list of presets to copy. It's a shared language so the agent and the user can name what they're going for, then build it.

When picking a direction for a new app or page:

1. Skim the patterns and short-list the 2–3 that fit the scenario.
2. Ask the user to pick one, or invoke `/design-shotgun` to generate visual variants and let the user choose by sight.
3. Then write the app's `DESIGN.md` against the chosen pattern's visual fingerprint.

Do **not** pick a pattern silently. Half the value of having a named vocabulary is that the user can say "more like #3, less like #5" without having to articulate it from scratch.

## The seven patterns

|   | Pattern | One-liner | Fits |
|---|---|---|---|
| 1 | [**Essay**](#1-essay) | Single-column, serif-led, paper-warm — built for sustained reading. | Long articles, monthly reviews, finished essays, book notes. |
| 2 | [**Sketchnote**](#2-sketchnote) | A scanned-in personal notebook page that lives as a website. | Research notes, project recap, "my thinking" pages, trip diaries. |
| 3 | [**Postcard**](#3-postcard) | A printed card you'd send by mail, rendered for the web. | Birthday surprise, invitation, thank-you, "made this for you" gifts. |
| 4 | [**Notebook**](#4-notebook) | A well-made stationery item — calm, daily, comfortable. | Personal tools used daily: todo, habit tracker, mood log, reading list. |
| 5 | [**Terminal**](#5-terminal) | Mono everywhere, keyboard-first, density over decoration. | Dev tools, internal dashboards, command palettes, data viewers. |
| 6 | [**Manifesto**](#6-manifesto) | Huge condensed display + full-bleed color blocks — one thesis per screen. | About pages, launch pages, position statements, single-page arguments. |
| 7 | [**Neo-Memphis Playful**](#7-neo-memphis-playful) | Cream + saturated panels + tape/stickers + chunky type. | Product landings, pricing pages, feature intros, tools with personality. |

The matrix they cover:

```
                  QUIET (page-like)              LOUD (assertive)

  CONTENT         Essay      Sketchnote*         Postcard      Manifesto
                  (finished) (process)           (occasion)    (position)

  TOOL/APP        Notebook   Terminal                          Neo-Memphis*
                  (daily)    (dev/data)                        (product)

                  (* = handmade / anti-grid sub-registers)
```

Notably **not** in this vocabulary — and the reasons matter:

- **Soft minimal "SaaS marketing" (Vercel / Linear style)** — this is what AI defaults to. The vocabulary's purpose is to *push the agent away* from that default, so it doesn't get its own entry.
- **Multi-column magazine with photography** — fits the same quiet-content slot as Essay; lab pages rarely need that level of editorial machinery.
- **Cyberpunk / vaporwave / pixel-art / solarpunk** — these are decorative *moods* you can layer onto Notebook or Terminal, not standalone patterns.
- **Luxury black-and-gold / industrial concrete-and-Helvetica** — strong commercial-brand registers that don't match the personal / small-team scale of a lab.

If a request genuinely doesn't fit any of the seven — say so to the user, propose a hybrid, and rely on `/design-shotgun` to explore beyond the vocabulary.

---

## 1. Essay

> Single-column, serif-led, paper-warm — built for sustained reading.

**Starter file** — copy `pages/essay.html` and rewrite the content; the typography is wired.

**When to reach for it** — Long-form articles, monthly reviews, finished essays, book notes. The page exists for reading, not for navigating or interacting.

**Mood words** — Thoughtful, calm, considered, literary, slow.

**Visual fingerprint**
- **Typography:** High-quality serif for body (Newsreader, Source Serif Pro, Crimson, Lora) at comfortable size (18–20px), generous line-height (1.6–1.8). Sans-serif optional only for metadata (date, byline). Italic for emphasis; avoid stacking bold + italic + color.
- **Color:** Cream or parchment background (#fbf6ee territory). Near-black ink, not pure black (#1d1a16). One subtle accent (rust, faded indigo, sage) for links and the occasional dropcap. Three colors maximum.
- **Layout & rhythm:** Single column, ~620–680px reading width, centered with asymmetric margins. Big breathing room top and bottom. Dropcap or large pull-quote for vertical rhythm. No sidebars, share widgets, or related-posts strips.
- **Texture:** None or near-zero. A barely-visible paper-grain background is the limit.

**Canonical references**
- Aeon Magazine's essay templates
- Construction Physics, Astral Codex Ten, and similarly type-disciplined Substacks
- Marginalia.nu
- Robin Sloan's individual essay posts
- Book interiors typeset by people who care (Robert Bringhurst's own books, Tschichold's later work)

**Don't confuse with**
- *Notebook* (working tool) — Essay is for finished thought, not in-progress capture.
- *Sketchnote* (handmade) — Essay is structurally disciplined, type-driven, no marginalia.

**Implementation cost** — DESIGN.md tokens fully sufficient. Needs: (a) one good serif (Google Fonts' Newsreader or Source Serif Pro are free; Tiempos or Söhne if budget exists); (b) strict typographic discipline — resist adding buttons, sidebars, social-share floats, "you may also like" sections. Essay's force is in restraint.

---

## 2. Sketchnote

> A scanned-in personal notebook page that lives as a website.

**Starter file** — copy `pages/sketchnote.html`; the washi-tape / handwriting fonts / ±rotations are already wired.

**When to reach for it** — When the page *is* a document of someone's thinking. Research notes, project retrospectives, trip recaps, "I read this book" pages — anything where authenticity matters more than polish.

**Mood words** — Personal, warm, present, imperfect, authentic.

**Visual fingerprint**
- **Typography:** Clean Chinese/English sans for typed body + a handwritten face (Xiaowei Pinyin, Xiaomei, Caveat, Patrick Hand, Architects Daughter) for annotations and headings. The mix of typefaces is deliberate.
- **Color:** Cream or paper background. Dark-ink body. Pastel marker colors (highlighter pink, yellow, mint) for emphasis. Washi-tape palette (dusty rose, slate blue, warm orange) for decoration.
- **Layout & rhythm:** Asymmetric, organic. Sticky notes, marginalia, arrows, circles. Elements deliberately rotated ±2–4°. No strict grid.
- **Texture & decoration:** Subtle paper grain. Washi-tape strips, "scotch tape corners" on photos, hand-drawn arrows and underlines, doodled icons. Photos slightly rotated.

**Canonical references**
- Mike Rohde's *The Sketchnote Handbook* and the Sketchnote Army community
- Austin Kleon's collage homepage and his *Steal Like an Artist* / *Show Your Work* books
- Hobonichi Techo planner usage galleries (ほぼ日手帳 使い方)
- Lynda Barry's *Syllabus* and *What It Is* — modern roots of hand-drawn + collage book design
- Frank Chimero's earlier essay layouts

**Don't confuse with**
- *Essay* — Essay is structurally disciplined and content-finished; Sketchnote is structurally loose and process-y.
- *Notebook* — Notebook is calm, gridded, daily-tool; Sketchnote is *actively anti-grid* and one-off.

**Implementation cost** — DESIGN.md tokens cover ~20%. Needs: (a) a PNG / SVG asset kit (washi-tape strips, torn-paper edges, sticky-note cards, hand-drawn arrows and circles) — generate via Midjourney with transparent backgrounds, or buy a Sketchnote kit from Creative Market / Etsy; (b) CSS `transform: rotate()` per element with small random angles; (c) the *content itself* has to deserve this register — a routine product update written in Sketchnote feels parodic. Roughly 70% of the success is content sincerity.

---

## 3. Postcard

> A printed card you'd send by mail, rendered for the web.

**Starter file** — copy `pages/postcard.html`; rewrite the body copy for your occasion. Stamp + flourish + signature are placeholders to adapt.

**When to reach for it** — Special-occasion pages: birthday surprises, anniversaries, invitations, thank-yous, "I made this page just for you" gifts. The page is itself an object of care.

**Mood words** — Warm, sentimental, occasional, deliberate, nostalgic.

**Visual fingerprint**
- **Typography:** Display serif or script for the headline (Cormorant, Playfair Display, Allura, Pinyon Script), often very large and centered. Clean sans (Inter, Söhne) for body. Optional handwritten font for a "signature" line.
- **Color:** Ornamental palette — dusty rose + sage + mustard + cream is a baseline; specific occasions get their own (deep red + cream + gold for celebrations; pastels for spring; navy + gold for graduation). 3–4 colors used decoratively.
- **Layout & rhythm:** Centered, ornamental. A single "card" composition that doesn't bleed to the edge of the viewport — sits on a darker mat. Borders, frames, or decorative corners are common.
- **Texture & decoration:** Ornamental dingbats, floral flourishes, stars, hand-drawn frames, ribbons. Slight letterpress / pressed-into-paper feel optional. Occasionally an envelope or wax-seal motif.

**Canonical references**
- Wedding invitation design tradition (any senior stationery designer's portfolio)
- Letterpress shops: Hatch Show Print (Nashville), Yee-Haw Industries, Studio on Fire
- Vintage greeting cards 1920s–1960s (Hallmark Heritage archive)
- Ladies of Letterpress members' work
- Rifle Paper Co.'s greeting card line

**Don't confuse with**
- *Essay* — Essay is for reading, not for celebrating.
- *Notebook* — Notebook is for everyday use; Postcard is a singular gesture.
- *Neo-Memphis Playful* — Memphis is product-brand bold; Postcard is intimate and decorative.

**Implementation cost** — DESIGN.md tokens cover the palette and fonts; the *composition* is the hard part. Needs: (a) decorative motifs (Unicode dingbats can suffice for minimal versions; SVG flourishes from Noun Project or Flaticon for richer ones); (b) a "card-on-mat" page layout — not the full-width responsive grid most React apps default to; (c) copy that matches — the page is a gesture, so the words have to do their job too.

---

## 4. Notebook

> A well-made stationery item — calm, daily, comfortable.

**Starter file** — copy `apps/todo/DESIGN.md` into your new app's `DESIGN.md` and adjust `name` / `description`; the palette + serif headings are tuned for this register. The whole `apps/todo/` is a working Notebook reference.

**When to reach for it** — Personal tools you actually use every day. Todo lists, habit trackers, mood logs, reading lists, drinking-water reminders, quick-capture pages. The page should disappear into your routine, not demand attention.

**Mood words** — Calm, comfortable, daily, reliable, quietly competent.

**Visual fingerprint**
- **Typography:** Serif for headings (Source Serif, Lora, Crimson) at modest sizes (no display type). System sans for body (-apple-system, Inter). Comfortable line-height (1.5–1.65). Italics for hints, never for whole sentences.
- **Color:** Warm cream / paper-white background. Soft ink for text (#3a3a35 not pure black). Borders in warm gray, never neutral gray. One muted accent (sage, faded blue, soft terracotta) for interactive elements — and only on interactive elements.
- **Layout & rhythm:** Clean grid, modest max-width (640–760px), comfortable spacing — more breathing room than a utilitarian SaaS dashboard, less than an editorial page. Lists with subtle dividers. Headers small relative to body.
- **Texture:** Subtle paper texture optional. Otherwise clean.

**Canonical references**
- Bear notes app
- iA Writer
- Notion's original / classic theme
- Hobonichi Techo printed planners (the planner itself, not just usage culture)
- Field Notes notebooks and Baron Fig planner pages
- The Newsprint, a quiet productivity blog

**Don't confuse with**
- *Essay* — Essay is for finished publication; Notebook is for working state.
- *Sketchnote* — Sketchnote is loose, decorative, anti-grid. Notebook is the *opposite*: composed, daily, quiet.
- *Terminal* — Terminal is dense + monospace + cool; Notebook is warm + serif + comfortable.

**Implementation cost** — DESIGN.md tokens fully sufficient. This is the easiest pattern to achieve well — shadcn primitives + the right tokens get you most of the way. The hard part is *restraint*: resist adding more icons, more colors, more sections. Notebook's strength is what's left out.

---

## 5. Terminal

> Mono everywhere, keyboard-first, density over decoration.

**Starter file** — copy `apps/counter/DESIGN.md` into your new app's `DESIGN.md` and adjust `name` / `description`; the mono stack + dark palette are wired. `apps/counter/` itself is a working Terminal-style static app.

**When to reach for it** — Developer tools, internal dashboards, command palettes, data viewers, anything where speed and density beat visual delight. The user is a power user; the page respects their time by getting out of the way.

**Mood words** — Precise, dense, professional, efficient, "I don't need to entertain you".

**Visual fingerprint**
- **Typography:** Monospace everywhere (JetBrains Mono, IBM Plex Mono, Fira Code, SF Mono, Berkeley Mono). 13–14px body. Tight line-height (1.4–1.5). Bold rare. Color used semantically (success green, warning amber, error red) — muted, not neon.
- **Color:** Dark mode by default (deep blue-black like #0e0f12, or true dark like #000). Light mode optional and cool-gray. High contrast text. One saturated accent (electric green, cyan, amber) for primary interactive elements, used sparingly.
- **Layout & rhythm:** Tight, dense, no wasted space. Tables feel like `ls -la` output. Status bar at bottom common. Keyboard shortcuts visible.
- **Texture:** Zero. Faux CRT scanlines or fake terminal window chrome are cosplay; avoid them.

**Canonical references**
- Vercel CLI documentation pages
- Linear's keyboard shortcut overlay and command palette
- Raycast
- The Charm ecosystem (charm.sh — Glow, Lipgloss, Bubble Tea showcase pages)
- VS Code's command palette and quick-open
- `htop`, `btop`, `lazygit` — the visual ancestors

**Don't confuse with**
- *Notebook* — Notebook is warm and sans-bodied; Terminal is cool and mono.
- *Manifesto* — Manifesto is loud and colorful; Terminal is quiet and restrained.

**Implementation cost** — DESIGN.md tokens plus a monospace font import is enough. Needs: (a) commit to mono everywhere — don't half-do it with mono headlines and sans body; (b) discipline against decorative chrome (no CRT scanlines, no green-on-black-matrix backgrounds, no fake terminal frames). Those are cosplay; real terminal tools don't have them.

---

## 6. Manifesto

> Huge condensed display + full-bleed color blocks — one thesis per screen.

**Starter file** — copy `pages/manifesto.html`; rewrite each section's label + headline + body for your own theses. The color cadence between sections (cream → red → yellow → black → blue) is the load-bearing part — swap colors deliberately.

**When to reach for it** — About pages, launch pages, principle statements, hiring pages, single-page arguments. The page exists to *take a position* and have the visual carry the conviction.

**Mood words** — Confident, opinionated, ambitious, hot, urgent.

**Visual fingerprint**
- **Typography:** Condensed display sans (Druk, Tungsten, Anton, Inter Display Black) in heavy weight at large sizes. Headlines often all-caps. Body mixed case. Monospace small labels for section markers ("01 — THE PROBLEM").
- **Color:** High-contrast block sections — black, cream, and saturated red / yellow / blue / green as full-bleed section backgrounds. Cream is the connective tissue between color blocks. One color, one section.
- **Layout & rhythm:** Full-bleed color sections, one core argument per screen, huge breathing room around the headline. Scrolling lands the user on a new thesis with each section.
- **Texture:** Zero. Flat. No shadows or gradients — all the force comes from typography and color.

**Canonical references**
- *Wired* magazine print covers, 1990s
- *Eye Magazine* overall visual identity
- Pentagram's political and cultural identity work (Saks, Penguin Books reissues, *The Atlantic* redesign)
- David Carson's *Ray Gun* magazine spreads
- Ableton's product launch pages
- Massimo Vignelli's later posters

**Don't confuse with**
- *Essay* — Essay is type-driven but quiet and serif. Manifesto is type-driven and *loud* and condensed sans.
- *Neo-Memphis Playful* — same color saturation, but Memphis adds tape and stickers and friendliness. Manifesto refuses any cuteness.

**Implementation cost** — DESIGN.md tokens cover palette and font choice; the *layout* is the work. Needs: (a) a heavy condensed display face — Anton is free on Google Fonts, Inter Display Black acceptable, Druk / Tungsten if budget exists; (b) a full-bleed section-by-section page layout (custom React, not generic content blocks); (c) someone with taste tuning sizes, leading, and the *cadence* between sections — this isn't a token swap, it's composition.

---

## 7. Neo-Memphis Playful

> Cream + saturated panels + tape/stickers + chunky type — friendly product personality.

**Starter file** — copy `pages/playful.html`; rewrite the hero copy, feature cards, and pricing block for your own product. Keep the chunky borders + offset shadows; swap the palette only if you keep the same saturation level.

**When to reach for it** — Product landing pages, pricing pages, feature intros, small tools with personality. The page is selling something but doing it warmly, with opinions and humor.

**Mood words** — Confident, friendly, witty, generous, "we like our work".

**Visual fingerprint**
- **Typography:** Chunky display sans (Inter Display, Founders Grotesk, Sharp Grotesk) for headlines. Clean sans (Inter, Söhne) for body. Dramatic size hierarchy, but not condensed-display dramatic.
- **Color:** Cream or near-white background. Saturated block colors in flat panels — hot pink, mint, mustard, baby blue, terracotta — multiple per page, one per panel. Black for text. 4–6 colors total used cheerfully.
- **Layout & rhythm:** Chunky cards with thick borders or shadows. Sections delineated by colored panels. Generous whitespace within each card. Sticker / tape / icon embellishments at corners.
- **Texture & decoration:** Faux-tape strips on card corners, faux-sticker icons, subtle hard shadows, modestly rounded corners. Hand-drawn or chunky illustrated icons. *Not* glossy 3D.

**Canonical references**
- Ettore Sottsass and the original Memphis Group (1981) — the design school this updates
- Risograph print tradition (Hato Press, Risolve Studio, ColorBox)
- *It's Nice That* magazine and website
- Glossier's early site (2014–2016)
- ColorBox by Lyft (defunct, but archived references)
- Cards Against Humanity packaging and site

**Don't confuse with**
- *Manifesto* — Manifesto is bold colors stripped to essentials. Memphis adds decoration: stickers, tape, illustrated icons. Manifesto is *serious*; Memphis is *playful*.
- *Sketchnote* — both have "handmade" energy, but Memphis is *printed and intentional*; Sketchnote is *scrappy and personal*.
- *Postcard* — Postcard is intimate and singular; Memphis is broadcast and product-brand.

**Implementation cost** — DESIGN.md tokens cover 70%. Needs: (a) a small decoration kit — tape strips, sticker icons, illustrated component embellishments — self-drawn or bought; (b) restraint with the palette: 5 saturated colors balanced into something pleasant (not a circus) is genuinely hard. Build a demo page first, get the user's sign-off on the balance, *then* commit to the rest of the app; (c) suits "pages with a product voice" — not workflows the user inhabits daily (use Notebook for that).

---

## When none of these fit

The vocabulary is intentionally narrow. If a request doesn't fit:

1. **Propose a hybrid out loud.** "I think this is mostly Notebook for the daily-use parts, but the about page wants Manifesto. Sound right?"
2. **Use `/design-shotgun`** to generate multiple visual variants and let the user choose by sight, without trying to name the result.
3. **Borrow from outside the vocabulary** if the user has a specific reference ("I want it to feel like the Stripe Press homepage"). Name the reference clearly in the app's `DESIGN.md` so future contributors know where the brand came from.

What the vocabulary is *for* is keeping the conversation moving without falling into "I'll just go with the AI default" (which is Soft Minimal SaaS, the entry deliberately omitted above). If a chosen pattern needs deviation, deviate consciously — and write down why in `apps/<slug>/DESIGN.md`.
