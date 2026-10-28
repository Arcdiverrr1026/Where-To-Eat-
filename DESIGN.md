---
name: Where To Eat
description: A concise Chinese interface for choosing a real nearby meal, set on warm parchment with a single ink-blue accent.
colors:
  parchment: "#f5f4ed"
  ivory: "#faf9f5"
  inline-bg: "#f0eee6"
  warm-sand: "#e8e6dc"
  brand: "#1b365d"
  brand-light: "#2d5a8a"
  brand-tint: "#e4ecf5"
  near-black: "#141413"
  dark-warm: "#3d3d3a"
  olive: "#504e49"
  stone: "#6b6a64"
  border: "#e8e6dc"
  border-soft: "#e5e3d8"
  line: "#d8d5c8"
  warn-bg: "#f0e0d8"
  warn-fg: "#8b4513"
typography:
  display:
    fontFamily: "Charter, \"Source Han Serif SC\", \"Noto Serif SC\", \"Songti SC\", \"STSong\", Georgia, serif"
    fontSize: "clamp(32px, 4.2vw, 48px)"
    fontWeight: 500
    lineHeight: 1.2
  title:
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
  secondary:
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  panel: "12px"
  control: "8px"
  tag: "4px"
---
# Design System: Where To Eat

## Overview

Visual language adapted from [Kami](https://github.com/tw93/Kami): **warm parchment canvas, one ink-blue accent, serif carries hierarchy, no cool grays, no hard shadows.** The interface is typographic and calm. There is no logo or brand mark; the name is set as plain text.

**Key Characteristics:**
- Flat surfaces. Depth comes from an ivory fill against parchment and one hairline, never from shadows.
- One serif family for everything; hierarchy from size, space and the 400/500 weight pair. No bold, no italic.
- Ink-blue is the only chromatic color and marks focus: the current page, prices, ratings, primary actions, favorites.

## Colors

- **Parchment** `#f5f4ed`: page background. Never pure white.
- **Ivory** `#faf9f5`: panels and input fields.
- **Ink blue** `#1b365d` (hover `#2d5a8a`, tint `#e4ecf5`): the single accent. Keep it to roughly 5% of any screen.
- **Text ladder:** near-black (primary) > dark-warm > olive (descriptions) > stone (meta, hints). Every gray has a yellow-brown undertone.
- **Rules:** `border` / `border-soft` for row and region separators, `line` for field edges.
- **States:** success uses the blue tint; warning uses warm sand; error uses the warm peach pair (`warn-bg` / `warn-fg`). Each also carries written text, never color alone.

**The One Accent Rule.** No second chromatic color. If a new state needs emphasis, use weight, rung or space first.

## Typography

System serif stack in frontmatter; no webfont dependency. Chinese falls back to Source Han Serif / Songti SC. iOS ships no Chinese serif, so there the Chinese text falls back to the system sans; this is accepted rather than shipping a font.

Sizes stay on one ladder: 12 / 13 / 14 / 15 / 17 / 20 / 28 / display. Weights are 400 and 500 only. Body letter-spacing is 0.02em for Chinese reading comfort; line-height 1.7+ for prose. Numbers use tabular figures.

## Layout

Shared maximum width 1240px, 40px gutters (28px at ≤900px, 20px at ≤760px). Discovery uses a 290px filter column plus a flexible results column with a 48px gap; filters sit directly on parchment and stick at ≥1100px. At ≤760px discovery becomes one column with filters first.

Spacing follows proximity: the gap above a heading is larger than the gap below it. Page headings use 72px above and 44px below on desktop.

## Elevation & Depth

No shadows. Panels (results, saved list, login, detail header, store info, admin) share one treatment: ivory fill, 1px `border`, 12px radius. Rows inside are divided by `border-soft` hairlines. Hover changes color only; ordinary panels never lift.

## Shapes

Radius follows role: panel 12px, control (buttons, fields) 8px, tag 4px. No pills.

## Components

- **Header:** parchment, bottom hairline. Plain text wordmark, text-only navigation; the current page is ink-blue with a 2px underline. No icons beside nav items.
- **Buttons:** primary is ink-blue with ivory text; secondary is ivory with a `line` border and warm-sand hover. Minimum height 44px. Hover rules sit inside `@media (hover: hover)`.
- **Fields:** ivory fill, `line` border, ink-blue border on focus, 2px ink-blue focus outline.
- **Results:** one shared panel with divided rows. Category and distance, name, address, price (blue) and review metadata, then a labeled recommendation reason.
- **Tags:** rating and state labels use the solid `brand-tint` fill with ink-blue text; muted state uses `inline-bg` with stone text.
- **Tabs:** text with an underline for the active tab, on a hairline.
- **Icons:** only where they carry function (favorite heart, search action, close, loading spinner). No decorative or brand icons.

## Do's and Don'ts

### Do:

- Do keep the search scope and recommendation reasons visibly labeled.
- Do keep unknown prices and missing data explicit.
- Do preserve focus outlines, skip link, `aria-current`, `aria-pressed` and live regions.
- Do adapt filters before results on compact screens.

### Don't:

- Don't add a logo, brand mark or decorative illustration.
- Don't add a second accent color, shadows, gradients, bold weights or italics.
- Don't use cool grays or pure white surfaces.
- Don't use restaurant imagery or invented reviews to fill unavailable states.
- Don't turn the application into a promotional landing page.
