---
version: alpha
name: Notebook
description: A quiet, editorial todo. Soft warm paper, ink-deep text, subtle hairlines. Made for daily focus, not for impressing anyone.
colors:
  primary: "#1f1f23"
  primary-on: "#ffffff"
  secondary: "#5a5a60"
  accent: "#9c4221"
  success: "#10693a"
  danger: "#a51c1c"
  surface: "#fbfaf6"
  surface-2: "#f4f1ea"
  border: "#e3ddd1"
  border-strong: "#cdc6b6"
  fg: "#1f1f23"
  fg-muted: "#7a7670"
  fg-soft: "#a8a39a"
typography:
  display:
    fontFamily: "Songti SC, 'Source Han Serif SC', 'Noto Serif SC', Georgia, serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.025em
  h1:
    fontFamily: "Songti SC, 'Source Han Serif SC', 'Noto Serif SC', Georgia, serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "Songti SC, 'Source Han Serif SC', Georgia, serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.01em
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  "2xl": 32px
  "3xl": 48px
---

# Notebook — Todo

## Overview

A personal notebook, not a productivity app. Pages are warm cream paper rather than blank white. Type is editorial — serif headlines paired with system sans body. Hairlines and whitespace do the work that drop shadows would in a SaaS dashboard.

The brand voice is quiet. No exclamation marks, no celebration animations. Done items become softer, not strikethrough party-poppers. Empty states are an italic line, not a CTA card.

## Colors

The neutrals are warm cream and aged paper, not slate or stone gray. **Surface (#fbfaf6)** is the base — it's a hint warmer than pure white, the way old paper looks under reading lamp light. **Surface-2 (#f4f1ea)** is for inset surfaces (input backgrounds, hovered rows).

Text uses **fg (#1f1f23)** — almost black but not quite. Pure black on cream is too harsh. **fg-muted (#7a7670)** for secondary copy; **fg-soft (#a8a39a)** for tertiary metadata, captions.

The accent is **#9c4221** — a deep terracotta. It's used sparingly: the brand color on the page header, the active border on focused inputs, the destructive button. Most of the page is neutral; the accent points at the one thing that matters.

Avoid pure white #fff anywhere. Avoid pure gray (zero chroma) — every neutral here is warm-tinted toward the accent hue.

## Typography

Two families:
- **Serif** for editorial moments — page titles, section labels (italic). Provides the "this is a personal artifact, not a SaaS" feel.
- **System sans** for body text and form controls. Fast to load, native-feeling, handles CJK and Latin uniformly.

Numbers use tabular figures (`font-feature-settings: 'tnum'`) so columns of dates and counts align.

## Layout

Generous white space. Breathing room between groups. Hairlines (1px border in `border` color) separate rows; do not nest cards. Maximum content width 480px on this app — it's designed to feel like a small notebook, not a dashboard.

## Components

- **Button**: solid (accent), outline (border + fg), or ghost (transparent + fg-muted). Slight border-radius (md / 8px). No drop shadows.
- **Input**: surface-2 background, border on focus shifts to accent. No box-shadow.
- **Card**: avoid. Use spacing + hairline divider instead. If absolutely needed, use border + border-radius lg, no shadow, no gradient.
- **Toast / banner**: not yet defined; default to a single line of italic serif text in fg-muted.

## Do's and Don'ts

- ✅ Hairlines, whitespace, italic serif for editorial moments
- ✅ Tinted neutrals, never pure black/white/gray
- ✅ Accent used as a single point of attention per view
- ❌ Card-on-card-on-card visual stacking
- ❌ Drop shadows (use hairline borders or background tint)
- ❌ Gradient text or gradient backgrounds (the AI-default tell)
- ❌ Bouncy / elastic motion (use ease-out cubic, never spring)
- ❌ Color-on-color buttons (e.g., accent button with accent text)
