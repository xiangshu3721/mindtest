---
name: 九份分开做
description: Equal catalog plates on ivory paper; open one assessment, stop there.
colors:
  paper: "#f3ece4"
  ink: "#241c18"
  muted: "#4e433d"
  sheet: "#faf6f1"
  still-life-hold: "#efe6dc"
  selection: "#edd5d4"
  mark-default: "#7a3140"
typography:
  display:
    fontFamily: "Songti SC, STSong, Noto Serif SC, Iowan Old Style, Palatino, serif"
    fontSize: "clamp(40px, 5vw, 64px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Songti SC, STSong, Noto Serif SC, Iowan Old Style, Palatino, serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "PingFang SC, Hiragino Sans GB, Avenir Next, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  lead:
    fontFamily: "PingFang SC, Hiragino Sans GB, Avenir Next, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  blurb:
    fontFamily: "PingFang SC, Hiragino Sans GB, Avenir Next, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "PingFang SC, Hiragino Sans GB, Avenir Next, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 560
    lineHeight: 1.55
  quiet:
    fontFamily: "PingFang SC, Hiragino Sans GB, Avenir Next, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  plate: "4px 22px 4px 22px"
spacing:
  desk-gutter: "24px"
  desk-gutter-mobile: "12px"
  desk-pad-y: "64px 0 80px"
  desk-pad-y-mobile-top: "32px"
  plates-gap: "22px"
  plates-gap-mobile: "16px"
  plates-offset: "48px"
  plates-offset-mobile: "28px"
  copy-pad: "16px 18px"
  copy-gap: "8px"
  meta-pad-top: "12px"
  close-offset: "36px"
components:
  plate:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "{spacing.copy-pad}"
  plate-enter:
    textColor: "var(--mark)"
    typography: "{typography.label}"
  plate-meta:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  desk-lead:
    textColor: "{colors.muted}"
    typography: "{typography.lead}"
  desk-close:
    textColor: "{colors.muted}"
    typography: "{typography.quiet}"
---

# Design System: 九份分开做

## Overview

**Creative North Star: "Nine Plates on One Desk"**

The catalog is one desk of ivory paper with nine equal mounted plates. Nothing is featured above the rest; the visitor reads a short title and instruction, then chooses exactly one plate. Titles sit in Songti; body copy stays in a system sans. Each plate carries a 4:3 still-life illustration and a single sentence. The only colored accent on a plate is the word 进入, tinted with that plate’s mark.

This system documents the catalog page (`index.html` / `css/home.css`) and the shared paper tokens it actually declares. Individual assessment apps keep their own stylesheets; their question-runner UI is out of scope here.

**Key Characteristics:**
- Equal plates in a fixed order; no hero plate and no leftover list
- Ivory paper desk, warmer sheet surfaces, ink-brown type
- Songti for page and plate titles; sans for body, blurbs, and meta
- Still-life images locked to 4:3 and mounted on the plate
- Per-plate `--mark` color appears only on 进入 (and focus outline when set)

## Colors

Warm paper neutrals carry the page. Accent is not a global brand tint; it is a plate-local mark used sparingly.

### Primary
- **Plate Mark** (per-plate `--mark`; focus fallback `{colors.mark-default}`): The only intentional accent on a plate. Applied to 进入 and to `:focus-visible` outline when a mark is in scope. Observed marks include `#1f3f38`, `#7a3140`, `#6b3a45`, `#1f4d3a`, `#243e5c`, `#8a4b12`, `#3f3a4a`, `#3e4f5a`.

### Neutral
- **Ivory Paper** (`{colors.paper}`): Page ground; body also layers a soft top wash `linear-gradient(180deg, rgba(255, 252, 248, 0.7), transparent 280px)`.
- **Ink Brown** (`{colors.ink}`): Primary text and default focus ink when no mark applies.
- **Muted Ink** (`{colors.muted}`): Lead, blurb, meta counts, and closing note.
- **Sheet** (`{colors.sheet}`): Plate surface behind copy.
- **Still-Life Hold** (`{colors.still-life-hold}`): Image placeholder background while the still life loads.
- **Selection Wash** (`{colors.selection}`): Text selection background.

### Named Rules
**The Enter-Only Mark Rule.** A plate’s mark color may tint 进入 and the focus outline. It must not wash the title, blurb, meta counts, border, or illustration frame.

**The Equal Plate Rule.** No plate receives a larger accent, badge, or featured treatment. Mark color does not create hierarchy between plates.

## Typography

**Display Font:** Songti SC (with STSong, Noto Serif SC, Iowan Old Style, Palatino)
**Body Font:** PingFang SC (with Hiragino Sans GB, Avenir Next, Segoe UI)

**Character:** Scholarly Songti for names; quiet sans for instructions and meta. Weight stays medium (500) on titles; meta uses 560 without bold shout.

### Hierarchy
- **Display** (500, `clamp(40px, 5vw, 64px)`, 1.05, −0.03em): Page title 九份分开做.
- **Title** (500, 22px desktop / 24px at ≤640px, 1.25, −0.02em): Plate assessment names.
- **Lead** (400, 17px, 1.55): Header sentence under the title; max-width 36em; muted.
- **Body** (400, 16px, 1.55): Default page text.
- **Blurb** (400, 15px, 1.55): One-sentence plate description; muted.
- **Label** (560, 13px, tabular-nums): Meta row — question count left, 进入 right.
- **Quiet** (400, 14px): Closing privacy/disclaimer line.

### Named Rules
**The Songti Title Rule.** Songti is reserved for the page title and plate titles. Blurbs, meta, lead, and close stay sans.

## Layout

The desk is a centered column `min(1120px, calc(100% - 48px))` with vertical padding 64px / 80px. Plates sit in a three-column grid with 22px gaps and 48px offset from the header. At 900px the grid becomes two columns; at 640px it becomes one column, gutters tighten to 24px total (`100% - 24px`), top padding drops to 32px, gap to 16px, and plates offset to 28px. Header lead is capped at 36em. Plate copy is a flex column with 8px gap; the meta row is pushed to the bottom with `margin-top: auto`.

### Named Rules
**The Three-Then-Collapse Rule.** Desktop shows three equal columns so the first viewport can hold three full plates under the title. Narrower viewports collapse to two, then one — never a featured row plus a remnant list.

## Elevation & Depth

Depth is quiet mount, not floating chrome. Plates use a hairline border, a light inset top edge, and a soft brown ambient shadow. On devices that support hover, a plate lifts 4px and the ambient shadow deepens. Reduced-motion users keep the rest pose with no transform.

### Shadow Vocabulary
- **Mounted rest** (`box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset, 0 14px 32px rgba(72, 42, 32, 0.06)`): Default plate.
- **Mounted hover** (`box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset, 2px 22px 44px rgba(72, 42, 32, 0.12)` with `translateY(-4px)`): Hover-capable pointers only; eased `0.45s cubic-bezier(0.16, 1, 0.3, 1)`.

### Named Rules
**The Mounted Plate Rule.** Shadows describe paper resting on the desk. Do not add hard offset drop-shadows, glow, or layered card stacks.

## Shapes

Plates use an asymmetric radius — tight top-left / bottom-left (4px), open top-right / bottom-right (22px) — so each sheet reads as a cut folio rather than a uniform card. Borders are 1px at `rgba(36, 28, 24, 0.08)`. Images fill the plate width at `aspect-ratio: 4 / 3` with `object-fit: cover` and are clipped by the plate’s overflow. Focus is a 2px solid outline using the plate mark (fallback `{colors.mark-default}`) with 3px offset.

### Named Rules
**The Folio Corner Rule.** Keep the 4 / 22 / 4 / 22 radius on catalog plates. Do not round all corners equally or pill the plate.

## Components

### Catalog Plate
Equal entry to one assessment. Full-height flex column; sheet background; folio corners; mounted shadow. Contains still-life image, Songti title, one muted blurb, and a meta row.

- **Shape:** Folio radius (`4px 22px 4px 22px`)
- **Background:** `{colors.sheet}` with border `rgba(36, 28, 24, 0.08)`
- **Hover / Focus:** Lift and deepen shadow on hover-capable devices; `:focus-visible` uses mark outline
- **Internal Padding:** Copy block `16px 18px`; meta gains `12px` top padding

### Enter Affordance
Not a filled button. The word 进入 is stressed label type in the plate’s `--mark`. Meta counts stay muted on the opposite side of the same row.

### Desk Header
Display Songti title plus one muted lead sentence (17px, max 36em). No kicker, badge, or secondary promo row.

### Desk Close
Single muted 14px line under the grid for device-local and non-diagnostic framing.

## Do's and Don'ts

### Do:
- **Do** keep all nine plates equal in size, structure, and chrome.
- **Do** put each plate’s mark color only on 进入 (and focus when that plate is targeted).
- **Do** lock still lifes to 4:3 and mount them at the top of the plate.
- **Do** use Songti for titles and sans for body, blurb, meta, and close.
- **Do** collapse the grid 3 → 2 → 1 without introducing a featured hero.

### Don't:
- **Don't** feature one assessment above the others or demote the rest into a leftover list.
- **Don't** spread mark color across titles, blurbs, borders, or image frames.
- **Don't** replace folio corners with uniform large radii or pill shapes.
- **Don't** fold scl90 / pdq / ecr question-runner chrome into this catalog system.
- **Don't** add kickers, eyebrows, floating badges, or stat strips to the first viewport.
