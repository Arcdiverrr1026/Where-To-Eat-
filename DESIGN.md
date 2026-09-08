---
name: Where To Eat
description: A private address book of personal restaurant experiences.
colors:
  ink: "#232925"
  muted: "#68716c"
  line: "#e5e9e6"
  green: "#257454"
  green-dark: "#185b3f"
  green-soft: "#eaf3ed"
  coral: "#b3503e"
  paper: "#ffffff"
  navigation: "#f5f7f5"
  rating: "#b17b27"
  provenance: "#70619b"
  provenance-soft: "#f1edf8"
  error: "#a24336"
  error-soft: "#fff1ed"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0"
  section:
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "14px"
    lineHeight: 1.95
    letterSpacing: "0"
  button:
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0"
  field:
    fontSize: "13px"
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontSize: "12px"
    fontWeight: 550
    letterSpacing: "0"
rounded:
  tag: "4px"
  feedback: "5px"
  control: "6px"
spacing:
  compact: "8px"
  control-gap: "10px"
  field-gap: "12px"
  form-gap: "20px"
  section-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.green-dark}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-subtle:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-icon:
    textColor: "{colors.muted}"
    backgroundColor: "transparent"
    rounded: "{rounded.feedback}"
    width: "34px"
    height: "34px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.green}"
    padding: "6px 0"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  source-friend:
    backgroundColor: "{colors.provenance-soft}"
    textColor: "{colors.provenance}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  message-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.feedback}"
    padding: "10px 13px"
---

# Design System: Where To Eat

## Overview

**Creative North Star: "Personal Address Book"**

A private address book of meals: white reading surfaces, pale green navigation, compact ink typography, and deliberate green actions. The interface supports revisiting personal records rather than browsing a public ratings feed. Chinese copy is direct and restrained; the Where To Eat name and existing illustrated brand mark remain visible.

The built world uses ruled lists, adjacent detail reading, and quiet forms. Amber communicates personal ratings, violet identifies imported provenance, and coral marks favorites. Decoration does not replace restaurant names, experience text, or source attribution.

This is a code-first record of the built interface, not a comp reconstruction. Authority is `frontend/src/library/styles.css`, `frontend/src/main.jsx`, and the library components, reconciled with `PRODUCT.md` and the direction contract in `frontend/index.html` (seed `d8702cd0`). The library surface is Operate; that surface mode is context, not a new global token.

**Key Characteristics:**
- White reading surfaces and pale green navigation.
- Ruled records instead of floating content cards.
- Compact Chinese-first hierarchy with visible provenance.
- Explicit actions, readable feedback, and responsive task continuity.

## Colors

Leaf green and paper neutrals carry the workspace; amber, violet, and coral distinguish meaning rather than decorate large surfaces. Frontmatter values are normative; smaller component-specific tints remain local CSS, not a newly invented palette scale.

### Primary
- **Leaf Green** (`green`): primary actions, selected filters, caret, active mobile navigation, and positive feedback.
- **Deep Leaf** (`green-dark`): primary-button hover.
- **Pale Leaf** (`green-soft`): selected-row hover and affirmative tag surfaces.

### Secondary
- **Rating Amber** (`rating`): filled rating stars and rating controls, never an aggregate popularity signal.
- **Provenance Violet** (`provenance`, `provenance-soft`): imported-source badges. The attribution footer has its own local violet treatment.

### Tertiary
- **Favorite Coral** (`coral`): favorite hearts in record rows.
- **Error Red** (`error`, `error-soft`): shared alert text and background. This is distinct from favorite state.

### Neutral
- **Reading Ink** (`ink`): principal text.
- **Muted Ink** (`muted`): metadata and fully opaque input/textarea placeholders.
- **Paper** (`paper`): reading canvas and standard controls.
- **Navigation Wash** (`navigation`): desktop sidebar.
- **Rule Gray** (`line`): row, section, and pane separators.

**The Semantic Accent Rule.** Keep green for actions and selection, amber for ratings, violet for provenance, and coral for row favorites; retain text or accessible names alongside meaning-bearing color.

## Typography

**Body and UI Font:** the system sans-serif stack recorded in frontmatter, including Chinese fallbacks. No separate display face or hero-scale display role is implemented. The existing brand wordmark is compact UI identity, not a display-type prescription.

### Hierarchy
- **Headline:** page headings; the frontmatter desktop role steps down to 24px at the narrow breakpoint.
- **Title:** ordinary section headings; restaurant details use a local 25px title, while editor/share section headings use 16px.
- **Section:** experience subheads and compact headings.
- **Body:** long experience text, limited to 70ch with preserved newlines. This role is not the browser body default; generic paragraphs use a 1.75 line height.
- **Button / Field:** compact control text, with button weight stronger than field content.
- **Label:** form labels. Metadata spans 10-13px depending on density; do not promote this range into a universal body-text size.
- **Code:** generated share codes use `ui-monospace, monospace`, at 16px desktop and 12px on narrow screens.

**The Reading Hierarchy Rule.** Keep restaurant names and experience text above metadata in emphasis, with zero letter spacing and wrapping for long content.

## Layout

The desktop workspace is a two-column grid: a sticky navigation rail (224px) and a shrinkable main area capped at 1540px. Main padding is 36px 40px 60px. Ruled rows and unframed sections establish density; repeated gaps use the frontmatter spacing vocabulary without pretending the stylesheet follows an exhaustive spacing scale.

The library pairs a selectable record list with full detail using `minmax(265px, .9fr) minmax(320px, 1.1fr)`. Detail content is capped at 720px. Editors and share builders use a main column plus a separated settings column; field grids retain two equal, shrinkable tracks.

Responsive behavior follows actual media queries:
- At 1600px and wider, main padding becomes 42px 60px.
- At 1120px and narrower, the rail becomes 200px, main padding tightens, editor tracks contract, and discovery search wraps.
- At 900px and narrower, the sidebar is replaced by a top brand/action header and fixed bottom navigation, including safe-area padding and reserved main-content bottom space.
- At 620px and narrower, headings/actions stack, library inline detail is hidden, and selecting a record opens its detail route. Editor and share-builder columns stack; their interior two-field grids remain two columns. Discovery places the map above results, with a 280px map height instead of 490px.
- The viewport floor is 320px. Main tracks, form controls, and content wrappers use shrinkable widths; headings and experience text wrap.

Discovery's budget field has a fixed desktop flex basis and width (120px). At the narrow breakpoint, budget and radius controls share the row with `flex: 1`; search and submit each occupy a full row. This is the corrected built behavior, not an instruction to apply fixed widths to all fields.

**The Record Continuity Rule.** Preserve access to the full record across viewport changes; mobile uses a dedicated detail route instead of squeezing the desktop split view.

## Elevation & Depth

The library stylesheet defines no box shadows. Depth comes from pale surface changes, thin rules, selected-row tint, and fixed or sticky placement. The map is a genuinely framed tool; it is not a decorative card around the workspace. Browser-native confirmations and externally rendered AMap content are outside this CSS vocabulary.

**The Ruled Surface Rule.** Separate records and sections with rules or tonal state changes, not lifted content cards.

## Shapes

Controls have gently squared corners using the control radius; tags use the smaller tag radius and feedback/icon controls use the feedback radius. Lists and section bands remain rectangular. One-pixel borders distinguish editable fields and bounded tools. Circles are native to account avatars and success marks, and the existing bitmap brand asset has rounded corners; these are not reasons to make all containers circular or pill-shaped.

## Components

### Buttons
Compact, explicit commands. Standard, primary, and subtle variants share a minimum height (40px), icon gap (8px), and frontmatter padding. Standard hover uses a pale wash and stronger border; primary hover deepens green. Subtle retains its border and transparent background, including on hover. Disabled buttons use half opacity and a not-allowed cursor. Background and border transitions last 150ms.

Icon buttons are fixed-size controls with Lucide SVGs, accessible labels, and native title tooltips. Text buttons are unframed green commands; their current CSS has no distinct hover treatment. Do not invent a pressed transform or custom tooltip system.

### Inputs / Fields
White, thin-bordered controls with persistent labels. Search is a pale inset field with an inline search icon. The general keyboard focus outline is 3px with a 3px offset; search uses a 2px focus-within outline with a 1px offset. Placeholder color is the fully opaque muted token, including the corrected value. Checkboxes and radios use green accent color; star-rating radios expose a visible focus-within state.

### Navigation
Desktop icon-and-label links have a minimum height (44px), pale hover, and a stronger green active surface. Mobile uses vertically arranged icon/label links and active green text. Source filters and authentication mode switches are underlined controls, not pills; source filters expose `aria-pressed`.

### Chips / Provenance
Small rectangular labels distinguish own and imported records. Imported badges are violet and name the author; the detail footer preserves source attribution. Ordinary tags and return-intent tags use their existing local tints. They are descriptive labels, not clickable filter chips.

### Record Rows / Containers
The signature record row is a full-width selectable button within a ruled list, not a card component. It combines name, rating, date, a two-line excerpt, source/category, and spend. Selected rows receive a pale green wash, with distinct hover. Detail facts form a three-column ruled strip. Share rows and preview entries reuse the flat, divided reading grammar.

### Feedback / Loading
Shared messages render errors as `role="alert"` and non-errors as `role="status"`. Logout failures appear in the main content above route content, so the same feedback remains available with either desktop or mobile navigation. Loading uses three pale rows pulsing over 1.5 seconds; reduced-motion preference disables animations and transitions.

### Sharing / Discovery
The generated share code is a read-only selectable field with a copy icon; previews preserve author and experience text. Discovery keeps place facts separate from experience records, with visible source attribution when results exist, map loading/error feedback, retry, and manual-entry paths.

Evidence boundary: supplied review images are `desktop.png`, `mobile.png`, `mobile-detail.png`, `mobile-editor.png`, `share-created.png`, `share-preview.png`, `mobile-logout-error.png`, `discover-real.png`, and `discover-real-mobile.png` under `.impeccable/review/`. The latest reviewer disposition was ship scoped to the three resolved fixes: placeholder contrast, shared logout alert, and discovery budget flex width. It is not a blanket accessibility or integration certification. Real external AMap search was unavailable with `USER_KEY_RECYCLED`; fallback/empty-state captures do not verify live search or a live map.

The sidecar's eight-step tonal ramps are synthesized preview metadata, not shipped CSS tokens or additional approved UI colors.

## Do's and Don'ts

### Do:
- **Do** keep private experience text and its source visually distinct from place data.
- **Do** reuse ruled rows, restrained controls, and the existing responsive navigation.
- **Do** keep placeholders at the muted token with full opacity and errors visible in the shared main-content alert.
- **Do** preserve reduced-motion behavior, keyboard focus, and accessible icon names.

### Don't:
- **Don't** turn the record library into a public popularity feed or promote imported text as the user's own experience.
- **Don't** replace flat reading sections with nested floating cards or oversized display headings.
- **Don't** present fallback restaurant states or supplied screenshots as verified live AMap service results.
- **Don't** treat synthesized sidecar ramps or one-off local values as new production token scales.
