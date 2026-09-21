# Design System — CargoMonitor / Smart Cargo

**Phase:** 2 — Design Direction & System  
**Date:** 2026-09-20  
**Source of truth:** `frontend/src/styles/tokens.css`  
**Tailwind bridge:** `frontend/tailwind.config.js`  
**Motion helpers:** `frontend/src/lib/motion.js`  
**Reference craft:** [Terminal Industries](https://terminal-industries.com/) — precision, industrial confidence, purposeful motion (adapted for a data-dense light console)

---

## 1. Concept & mood

**Concept name:** Control Tower  

**One-liner:** A precise logistics operating surface — calm canvas, ink chrome, steel-teal signal — that makes fleet state feel authoritative without shouting.

| Attribute | Direction |
|-----------|-----------|
| Personality | Confident, modern, trustworthy |
| Mood | Cool industrial, ordered, high-signal |
| Inspiration | Terminal’s structure & craft; **not** a dark-site clone |
| Ops UI | Light canvas + dark sidebar ink + restrained signal accent |
| Marketing | Same tokens; larger type, more atmosphere, product photography |
| Avoid | Purple SaaS gradients, cream/terracotta serif kits, newspaper grids, glow spam |

**Brand naming (decision)**

| Context | Name |
|---------|------|
| External / marketing | **CargoMonitor** |
| In-product console | **Smart Cargo** (subtitle: Monitoring Workspace / Operations Console) |
| Browser tab | `CargoMonitor — Smart Cargo Console` |

---

## 2. Typography

| Role | Family | Weight | Notes |
|------|--------|--------|-------|
| UI / body | **Geist Sans** | 400–700 | Loaded globally via `@fontsource` in `main.jsx` |
| Data / IDs / telemetry | **Geist Mono** | 400–500 | Trip codes, device IDs, numeric readouts |
| Display (marketing) | Geist Sans (tight tracking) | 700 | `--tracking-display: -0.04em`; no third-party Orbitron CDN |

**Scale**

| Token | Size | Use |
|-------|------|-----|
| `--text-xs` | 12px | Eyebrows, meta |
| `--text-sm` | 13px | Secondary UI |
| `--text-base` | 15px | Body |
| `--text-lg` | 17px | Emphasized body |
| `--text-xl`–`--text-4xl` | 20–36px | Page titles |
| `--text-display` | clamp(40–72px) | Landing heroes |

**Rules**

- One display voice; no competing decorative fonts.
- Eyebrows: uppercase + `--tracking-eyebrow` (0.16em), muted color.
- Page titles: tracking-tight, never all-caps.

---

## 3. Color palette & contrast

### Foundations

| Token | Hex | Role |
|-------|-----|------|
| `--cm-ink` | `#0B1220` | Brand ink, sidebar depth, primary dark CTAs |
| `--cm-canvas` | `#F1F4F8` | App background |
| `--cm-surface` | `#FFFFFF` | Cards / panels |
| `--cm-border` | `#D5DDE8` | Dividers, panel edges |
| `--cm-text` | `#102236` | Primary text |
| `--cm-text-muted` | `#64768A` | Secondary text |
| `--cm-signal` | `#0B6E8F` | Primary action / focus / links |
| `--cm-signal-muted` | `#E6F3F8` | Soft signal fills |

### Status

| Token | Hex | BG | Use |
|-------|-----|-----|-----|
| Success | `#0F7A4F` | `#E8F6EF` | Online, OK, resolved |
| Warning | `#A15C07` | `#FFF6E5` | Degraded, attention |
| Danger | `#B42318` | `#FDECEC` | Critical, offline, errors |
| Info | `#1D4ED8` | `#EEF3FF` | Informational pills |

### Contrast targets (WCAG AA)

| Pair | Approx ratio | Target |
|------|--------------|--------|
| `--cm-text` on `--cm-canvas` | ~12:1 | AAA body |
| `--cm-text-muted` on `--cm-surface` | ~4.6:1 | AA body (verify in Phase 6) |
| `--cm-signal` on `--cm-surface` | ~5.2:1 | AA for UI text/links |
| `--cm-signal-foreground` on `--cm-signal` | ~7:1+ | AA large/UI |
| White on `--cm-ink` | ~16:1 | AAA |
| Success/Warning/Danger text on their BG | ≥4.5:1 | AA (pill text uses darker tone on tinted BG) |

**Rule:** Never convey status by color alone — always pair with label (and icon where space allows).

### Tailwind usage

```html
bg-canvas text-foreground
bg-signal text-signal-foreground
bg-success-bg text-success border-success-border
shadow-md rounded-lg
duration-normal ease-standard
```

HSL shadcn tokens (`--primary`, `--background`, …) are aligned to this palette so existing `bg-primary` / `text-muted-foreground` classes stay coherent.

---

## 4. Grid, spacing, radius, shadow

### Spacing (4px base)

`1 2 3 4 5 6 8 10 12 16 20 24` → 4–96px via `--space-*`

| Context | Token / value |
|---------|----------------|
| Portal max width | `--layout-max: 1360px` |
| Gutter | `--layout-gutter` (16px) |
| Content stack gap | 16px (`--space-4`) |
| Sidebar width | `--sidebar-width: 240px` |
| Section rhythm (marketing) | 64–128px vertical |

### Radius scale

| Token | Value | Use |
|-------|-------|-----|
| `sm` | 6px | Inputs, chips |
| `md` | 10px | Buttons, small cards |
| `lg` | 14px | Panels |
| `xl` | 18px | Sidebar, large shells |
| `2xl` | 24px | Marketing cards |
| `full` | pill | Status pills, rare CTAs |

**Rule:** Prefer `md`/`lg` in the portal. Reserve `2xl` + pills for marketing and status chips — not every box.

### Elevation

| Token | Use |
|-------|-----|
| `shadow-xs` / `sm` | Resting controls |
| `shadow-md` | Panels / cards |
| `shadow-lg` | Overlays, map shells |
| `shadow-sidebar` | Sidebar only |
| `shadow-glow` | Marketing signal CTAs sparingly |

---

## 5. Iconography & imagery

| Domain | Style |
|--------|-------|
| Icons | **Lucide** only going forward (24px grid, 1.5–2px stroke) |
| Metric glyphs | Keep `MetricIcons.jsx` until Phase 3; then align stroke to Lucide |
| Deprecate | `@phosphor-icons/react` (unused — remove in Phase 6) |

**Imagery**

- Prefer real product hardware / yard / container photography (already on landing).
- Maps are a first-class visual — treat MapLibre as part of the brand surface (calm basemap, signal markers).
- No stock “abstract blob” heroes; no emoji as UI.

---

## 6. Motion principles

### Intent

Motion **guides attention, confirms action, or shows relationship**. No decorative loops on data-critical controls.

### Easing

| Name | Curve | Use |
|------|-------|-----|
| `standard` | `cubic-bezier(0.22, 1, 0.36, 1)` | Most UI |
| `emphasized` / `entrance` | `cubic-bezier(0.16, 1, 0.3, 1)` | Enter / reveal |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | Dismiss |

### Duration

| Token | Time | Use |
|-------|------|-----|
| instant | 80ms | Opacity toggles |
| fast | 140ms | Hover / press |
| normal | 220ms | Default transitions |
| moderate | 320ms | Panel entrance |
| slow | 480ms | Page section reveal |
| deliberate | 700ms | Hero atmosphere only |

### Stagger

- Lists / KPI rows: **60–100ms** between children (`--stagger-sm` / `--stagger-md`)
- Max ~6 staggered items in view; beyond that, fade group as one

### Scroll

- Marketing: gentle section reveals (opacity + 12px Y), once per section
- Portal: **no scroll-jacking**; keep operators in control
- `scroll-behavior: smooth` only where it helps in-page anchors on marketing; disabled under reduced motion

### Micro-interactions

| Pattern | Behavior |
|---------|----------|
| Button hover | Color shift + optional 1px lift (`pressable()` helper) |
| Button press | `scale(0.98)` |
| Nav active | Ink fill / inset border (sidebar) |
| Data refresh | Prefer subtle “updated” cue over full re-animating KPIs every 5s |
| Modal / drawer (Phase 3) | Fade overlay + surface entrance |

### `prefers-reduced-motion`

1. CSS: durations collapse to ~1ms in `tokens.css`; global kill-switch in `index.css` for animations/transitions.
2. JS: `prefersReducedMotion()` + Framer presets in `lib/motion.js` skip transforms.
3. Keep loaders as static or simple opacity if motion is reduced (no endless float/pulse).

### Property rule

Animate **`transform` and `opacity` only** (and `color`/`background` for state). Never animate `top/left/width/height` for decoration.

---

## 7. Component state contract (for Phase 3)

Every primitive must implement:

`default → hover → focus-visible → active → disabled → loading → error` (where applicable)

Plus sizes: `sm | md | lg` and variants: `primary | secondary | ghost | destructive | outline`.

Shared focus: `:focus-visible` uses `--cm-focus-ring` (already global in `index.css`).

### Phase 3 primitives (implemented)

Import from `@/components/ui` or individual files under `src/components/ui/`.

| Primitive | File | Notes |
|-----------|------|-------|
| Button | `button.jsx` | variants + loading |
| Input / Textarea / Select / Label / FieldLabel / FieldHint | `input.jsx` | error + disabled |
| Checkbox / Switch | `checkbox.jsx` | keyboard switch |
| Modal | `modal.jsx` | Escape, focus, aria |
| Dropdown | `dropdown.jsx` | menu + items |
| Tooltip | `tooltip.jsx` | hover/focus |
| Tabs | `tabs.jsx` | tablist semantics |
| ToastProvider / useToast | `toast.jsx` | wired in `App.jsx` |
| Card / MetricCard | `card.jsx` | KPI tone borders |
| Table | `table.jsx` | scroll wrapper |
| Badge | `badge.jsx` | status tones |
| Alert | `alert.jsx` | inline banners |
| Spinner / Skeleton | `spinner.jsx` | loaders |
| EmptyState / ErrorState | `empty-state.jsx` | dashed panels |
| SidebarNav / PageHeader / SiteFooter | `navigation.jsx` | shell chrome |

Legacy wrappers: `StatusPill` → Badge, `SummaryCard` → MetricCard, `StatusCard` → Card.

---

## 8. File map

| File | Responsibility |
|------|----------------|
| `src/styles/tokens.css` | All CSS variables (color, type, space, radius, shadow, motion) |
| `src/index.css` | Imports tokens; legacy portal CSS; reduced-motion; landing aliases |
| `tailwind.config.js` | Maps tokens → Tailwind utilities |
| `src/lib/motion.js` | Framer-friendly presets |
| `src/main.jsx` | Global Geist font faces |
| `docs/design-system.md` | This document |
| `docs/design-audit.md` | Phase 1 findings |

---

## 9. Migration notes (do not skip ahead)

- **Phase 2 does not redesign pages.** Legacy hex in `index.css` remains until Phase 3–4 migrates classes to tokens.
- Bridged already: `:root` / shadcn HSL, landing CSS vars, sidebar, `.panel-surface`, `.auth-submit`, document title, floating/pulse keyframes, global fonts + focus-visible.
- Phase 3 builds primitives on these tokens.
- Phase 4 restyles pages top-down (Home → Login → Shell → Fleet…).

---

## 10. Assumptions

1. Light ops console is correct for 8-hour operator sessions; dark ink is reserved for chrome (sidebar) and marketing ink bands.
2. Steel-teal **signal** replaces prior sky-blue / Atlassian `#0052cc` accents over time.
3. Geist-only type stack is enough for award-level craft if hierarchy and spacing are disciplined; no new font dependency without bundle justification.
4. Framer Motion stays; new page motion should import `lib/motion.js` presets rather than one-off springs.
