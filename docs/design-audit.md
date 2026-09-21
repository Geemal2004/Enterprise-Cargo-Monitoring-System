# Design Audit — Smart Cargo / CargoMonitor

**Phase:** 1 — Discovery & Audit  
**Date:** 2026-09-20  
**Scope:** `frontend/` (React + Vite + Tailwind)  
**Audience:** B2B logistics clients  
**Brand target:** Confident, modern, trustworthy (reference: [Terminal Industries](https://terminal-industries.com/))  
**Assumption:** The provided screen recording (`Screen Recording 2026-09-20 202418.mp4`) illustrates the desired premium motion / industrial-logistics craft bar (Terminal-like: bold type, deliberate scroll rhythm, subtle glow, structured grids). Video was not frame-analyzed in this pass; reference site + recording path inform the quality bar for later phases.

---

## Executive snapshot

The product is a working multi-tenant IoT cargo operations console with a marketing landing page and a role-gated portal. Visual craft is **uneven**: Fleet Overview has begun a modern Tailwind + Framer Motion pass; most other portal pages still use a shared “panel-surface / data-table” CSS layer from `index.css`. The landing page has a separate design language and brand name. There is **no single design system**, no shared Button/Input primitives, and several unused or legacy dependencies.

**Highest-impact gaps:** brand/token fragmentation, missing focus-visible system, orphan `/dashboard` page, dual map stacks in package.json, inconsistent typography loading, and first-impression pages (Home + Login + Fleet) not yet speaking one voice.

---

## a) Pages / routes and purpose

| Route | Page file | Auth | Purpose |
|-------|-----------|------|---------|
| `/` | `pages/HomePage.jsx` | Public | Marketing landing (hero, solutions, industries, signup/contact) |
| `/login` | `pages/LoginPage.jsx` | Public | Email/password login → redirect to `/fleet` (or prior path) |
| `/dashboard` | `pages/DashboardPage.jsx` | **Public (no auth)** | Legacy single-device telemetry dashboard; **outside** `AppLayout` |
| `/fleet` | `pages/FleetOverviewPage.jsx` | Auth | Primary ops home: summary stats + live fleet table |
| `/analytics` | `pages/AnalyticsPage.jsx` | Auth | Full-bleed MapLibre map of all GPS-fixed containers |
| `/alerts` | `pages/AlertsPage.jsx` | Auth | Alert KPIs + filterable alerts log |
| `/detail/:truckId/:containerId` | `pages/TruckDetailPage.jsx` | Auth | Asset deep-dive: sensors, trips, map/route, trends, AI day summary, health |
| `/trips` | `pages/TripsPage.jsx` | Auth + roles (`super_admin`, `tenant_admin`, `admin`, `fleet_manager`) | Create/start/complete trips; map pick origin/destination |
| `/trips/:tripCode` | `pages/TripDetailPage.jsx` | Same as trips | Trip detail + path replay map |
| `/ota` | `pages/OtaPage.jsx` | Auth + roles (`super_admin`, `tenant_admin`, `admin`) | Wi-Fi config + OTA firmware upload/trigger (SSE) |
| `/admin/users` | `pages/UserManagementPage.jsx` | Auth + roles (`super_admin`, `tenant_admin`, `admin`) | Create/edit users, roles, password reset |
| `/admin/fleet-manager-assignments` | `pages/FleetManagerAssignmentsPage.jsx` | Auth + `super_admin` | Assign managers to truck/container pairs |
| `*` (inside portal) | → `/fleet` | Auth | Catch-all |
| `*` (outside) | → `/` | — | Catch-all |

**Shell:** Authenticated portal routes render inside `components/AppLayout.jsx` (sidebar + outlet) wrapped by `FleetDataProvider` (5s poll).

**Document title / brand strings in use today**

- `index.html`: “Logistics Co. Cargo Dashboard”
- Landing: **CargoMonitor**
- Portal sidebar / login: **Smart Cargo**
- Eyebrow: “Operations Console” / “Enterprise Access”

---

## b) Reusable components (paths + usage)

### Layout / guards

| Component | Path | Used by |
|-----------|------|---------|
| `AppLayout` | `components/AppLayout.jsx` | All authenticated portal routes (`App.jsx`) |
| `RequireAuth` | `components/RequireAuth.jsx` | Portal route group |
| `RequireRole` | `components/RequireRole.jsx` | OTA, trips, admin routes |
| `NavItem` (inline) | inside `AppLayout.jsx` | Sidebar nav only |

### Domain / data UI

| Component | Path | Used by |
|-----------|------|---------|
| `FleetTable` | `components/FleetTable.jsx` | `FleetOverviewPage` |
| `StatusCard` | `components/StatusCard.jsx` | `TruckDetailPage`, `DashboardPage` |
| `SummaryCard` | `components/SummaryCard.jsx` | `AlertsPage` |
| `StatusPill` | `components/StatusPill.jsx` | `AlertsTable`, `CargoHealthPanel`, `DeviceHealthPanel`, `TruckDetailPage` |
| `AlertsTable` | `components/AlertsTable.jsx` | `AlertsPage` |
| `AlertPanel` | `components/AlertPanel.jsx` | `DashboardPage` only (legacy) |
| `DeviceSelector` | `components/DeviceSelector.jsx` | `OtaPanel`, `WifiPanel`, `DashboardPage` |
| `TrendCharts` | `components/TrendCharts.jsx` | `TruckDetailPage` (Recharts) |
| `RecentChart` | `components/RecentChart.jsx` | `DashboardPage` only (Recharts) |
| `TruckMap` | `components/TruckMap.jsx` | `TruckDetailPage`, `DashboardPage` |
| `CargoHealthPanel` | `components/CargoHealthPanel.jsx` | `TruckDetailPage` |
| `DeviceHealthPanel` | `components/DeviceHealthPanel.jsx` | `TruckDetailPage` |
| `OtaPanel` | `components/OtaPanel.jsx` | `OtaPage` |
| `WifiPanel` | `components/WifiPanel.jsx` | `OtaPage` |
| `MetricIcons` | `components/MetricIcons.jsx` | `TruckDetailPage`, `DashboardPage` |
| Map primitives | `components/ui/map.jsx` | `AnalyticsPage`, `TripsPage`, `TripDetailPage`, `TruckDetailPage`, `TruckMap` |

### Page-local / duplicated primitives (not shared)

| Inline UI | Location | Overlaps with |
|-----------|----------|---------------|
| `StatCard` | `FleetOverviewPage.jsx` | `SummaryCard` / `StatusCard` |
| `TableStatusPill` | `FleetTable.jsx` | `StatusPill` |
| `UnitStatusPill` | `OtaPanel.jsx` | `StatusPill` |
| `RolePicker` | `UserManagementPage.jsx` | Would be a shared form control |
| `SiteNav`, `Hero`, sections | `HomePage.jsx` | Landing-only; no portal reuse |
| `MapClickHandler` | `TripsPage.jsx` | Trip map UX only |

### Context / hooks / API (not visual, but flow-critical)

| Module | Path | Role |
|--------|------|------|
| `AuthContext` | `context/AuthContext.jsx` | Session, roles, login/logout |
| `FleetDataContext` | `context/FleetDataContext.jsx` | Fleet + alerts polling |
| `useDashboardData` | `hooks/useDashboardData.js` | Legacy dashboard polling |
| `useDeviceHistory` | `hooks/useDeviceHistory.js` | Detail history series |
| APIs | `api/{client,auth,telemetry,trips,admin,reports}Api.js` | Data contracts |

### Missing foundation primitives (needed in Phase 3)

No shared: Button, Input, Select, Checkbox, Toggle, Modal, Dropdown, Tooltip, Tabs, Toast, Skeleton, EmptyState, ErrorBoundary UI, Footer (portal), PageHeader.

Forms and actions reuse ad-hoc classes: `.table-action`, `.auth-submit`, `.form-input`, Tailwind one-offs on Fleet Overview.

---

## c) User flows (step by step)

### 1) Prospect → customer interest (marketing)

1. Land on `/` (HomePage).
2. Browse Solutions / Industries / Customers anchors.
3. Choose path:
   - **Login** → `/login`
   - **Sign up** → `mailto:` request (no in-app signup)
   - **Contact / Demo** → `#contact` or mailto
4. No product onboarding wizard exists after account creation (admin-provisioned users assumed).

### 2) Authentication

1. Open `/login` (or get redirected from protected route with `state.from`).
2. Enter email/password → `AuthContext.login` → session stored.
3. Redirect to `state.from` or `/fleet`.
4. Session bootstrap: `RequireAuth` shows “Checking session” panel while validating token.
5. Sign out from sidebar → clears session (returns to public routes on next protected hit).

### 3) Day-to-day operations (primary)

1. **Fleet Overview** (`/fleet`): scan KPIs → open unit via FleetTable → `/detail/:truckId/:containerId`.
2. On **Truck Detail**: read live sensors → map/route → trends → cargo/device health → optional AI day summary → related trip links.
3. **Analytics** (`/analytics`): spatial overview of GPS-fixed assets.
4. **Alerts** (`/alerts`): severity KPIs → filter log → identify incident → navigate mentally/manually to detail (no deep-link from alert row to detail today).

### 4) Trip lifecycle (role-gated)

1. `/trips` → fill create form (truck/container, cargo type, origin/destination; map click to pick coords).
2. Create trip → appears in table.
3. Start / Complete actions on row.
4. Open `/trips/:tripCode` for detail + telemetry path.

### 5) Device / network admin (role-gated)

1. `/ota` → select unit → Wi-Fi scan/connect (`WifiPanel`) and/or upload/trigger OTA (`OtaPanel`).
2. Live feedback via SSE events.

### 6) Tenant / platform admin (role-gated)

1. `/admin/users`: list → create user → edit roles/status → reset password.
2. `/admin/fleet-manager-assignments` (super_admin): scope tenant → assign manager to pair → end assignment.

### 7) Legacy / parallel path

1. `/dashboard` remains reachable without auth and without portal chrome — parallel to Fleet/Detail, uses older component composition (`AlertPanel`, `RecentChart`, classes like `app-shell` / `topbar` that are **not defined** in current `index.css`).

---

## d) Current design tokens

### Color — three competing systems

**1. CSS variables (`:root` in `index.css`) — shadcn-style HSL**

| Token | Value (approx) |
|-------|----------------|
| `--background` | `210 40% 98%` (~#f8fafc) |
| `--foreground` | `215 40% 16%` |
| `--primary` | `210 76% 46%` (blue) |
| `--destructive` | `0 84% 60%` |
| `--muted-foreground` | `215 16% 47%` |
| `--border` / `--input` | `214 32% 91%` |
| `--radius` | `10px` |

**2. Hardcoded portal CSS (majority of UI)**

- Page bg: `#eef2f6` + radial gradient
- Sidebar: `#0e1822` / `#1e293b` active
- Panels: white → `#fbfdff`, borders `#d9e3ee`
- Status greens/ambers/reds: `#22a06b`, `#d97706`, `#dc2626` (+ pill variants)
- AI insight accent: `#0052cc` (Atlassian-like blue, off-system)
- Auth CTA: `#0f4c81`

**3. Landing scoped vars (`.landing`)**

- Ink `#0f172a`, accent `#7dd3fc` / `#38bdf8`, soft gray surfaces
- Gradients: hero slate, accent cyan, ink dark

**4. Tailwind `brand.*` in `tailwind.config.js`**

- `brand-50`…`brand-900` sky blues — **barely/never referenced** in components audited

**5. Fleet Overview ad-hoc**

- Tailwind `slate` / `emerald` / `amber` / `rose` utilities — parallel status palette to CSS pills

### Typography

| Intent | Declared | Actually loaded? |
|--------|----------|------------------|
| Portal body | Geist Sans → Manrope → system | Geist only imported on **FleetOverviewPage**; global stack may fall back |
| Mono | Geist Mono (package present) | Same page-local import |
| Landing display | Space Grotesk, Inter | **Not loaded** via `@fontsource` or `<link>` |
| Landing hero flair | Orbitron via remote `@font-face` (onlinewebfonts CDN) | Loaded remotely; fragile + privacy/perf risk |
| HTML body class | `font-sans` (Tailwind default = system) | Competes with `:root` font-family |

### Spacing / layout

- Portal shell max width: **1360px**, padding `14–16px`
- Layout gap: **18px** sidebar/content; content stack **16px**
- Panel padding: **16px**; summary cards **14px**; table cells **9–11px**
- No documented 4/8px spacing scale; values scatter `4 / 6 / 8 / 10 / 12 / 14 / 16 / 18`

### Radii

- `--radius: 10px`
- Panels `14px`, sidebar `18px`, cards `12px`, pills `999px`, landing cards `rounded-3xl`, buttons mix `8–10px` and full pills

### Shadows

- Soft card: `0 10px 30px rgba(15,23,42,0.06)`
- Sidebar: `0 18px 40px rgba(15,23,42,0.24)`
- Landing: `--landing-shadow-soft|glow|card`
- No named elevation scale (sm/md/lg)

### Breakpoints (custom in CSS)

| Width | Behavior |
|-------|----------|
| ≤1024px | Single-column portal; detail/sensor grids collapse |
| ≤760px | Header stacks; summary 1-col; forms 1-col |
| ≤560px | Sensor grid 1-col |
| Tailwind defaults | Also used on Home + Fleet Overview (`sm`/`md`/`lg`) |

### Motion (today)

- `framer-motion` on Fleet Overview only (entrance stagger, hover scale)
- `tailwindcss-animate` available; used lightly in map UI
- Home references `animate-pulse-ring` / `animate-float` — **no `@keyframes` definitions found** in `index.css` (broken/no-op animations)
- No `prefers-reduced-motion` handling

### Iconography

- **Lucide** used widely (Home, Fleet, Wifi, map controls)
- **Custom SVG** metric icons (`MetricIcons.jsx`) with `aria-hidden`
- **`@phosphor-icons/react` in package.json but unused in `src/`**

### Imagery

- Landing: product photos (`containernode.jpg`, `/node1.jpeg`, `/node2.jpeg`, assets)
- Portal: maps as primary visual; otherwise icon + number cards
- Leaflet marker assets still wired in `main.jsx` though maps use MapLibre

---

## e) Inconsistencies

### Brand & product naming

- CargoMonitor (marketing) vs Smart Cargo (portal) vs Logistics Co. (document title)
- “Control Panel / Fleet Command” vs “Operations Console / Monitoring Workspace”

### Visual language split

| Surface | Look |
|---------|------|
| Home | Editorial landing: large display type, cyan accent, rounded-3xl cards, full-bleed sections |
| Login / most portal pages | Soft gray enterprise panels, CSS class system, dark sidebar |
| Fleet Overview | Newer Tailwind white cards + motion — closest to “premium SaaS” |
| Dashboard (`/dashboard`) | Orphan layout classes; visually broken / unstyled relative to portal |

### Component duplication

- Three pill implementations (`StatusPill`, `TableStatusPill`, `UnitStatusPill`)
- Two KPI card patterns (`SummaryCard` CSS vs `StatCard` Tailwind)
- Two chart components overlapping purpose (`TrendCharts` vs `RecentChart`)
- Two map libraries in dependencies (MapLibre active; Leaflet/react-leaflet **unused in src**, still imported CSS/icons in `main.jsx` + CDN Leaflet CSS in `index.html`)
- Two chart libraries in package.json (Recharts used; **chart.js / react-chartjs-2 unused**)

### Spacing / radius / color mismatch

- Fleet Overview uses Tailwind spacing; Alerts/Trips/Admin use `.page-grid` / `.panel-surface`
- Accent blues: primary HSL vs `#0f4c81` vs `#0052cc` vs landing cyan
- Status colors differ slightly between CSS pills and Tailwind emerald/rose sets

### Interaction states

| Control | Hover | Focus-visible | Loading | Empty | Error | Disabled |
|---------|-------|---------------|---------|-------|-------|----------|
| Sidebar nav | Yes | Weak / browser default | N/A | N/A | N/A | N/A |
| `.table-action` | Yes | No custom ring | Text swap sometimes | — | — | Opacity only |
| `.form-input` | — | Outline (not `focus-visible` system) | — | — | Parent error box | Yes on login |
| Fleet CTA | Motion scale | No ring | — | — | — | — |
| Map controls | Yes (map.jsx) | Yes (`focus-visible:ring`) | Spinner | — | — | — |
| Toasts | **None** | — | — | — | Inline `.error-box` / `.notice-box` | — |
| Skeletons | **None** | — | Text “Loading…” | Text present on tables | Yes | Partial |

### Accessibility gaps (inventory)

- Almost no `aria-*` outside map controls and decorative metric icons
- No skip link; sidebar is first focus region on every portal page
- `RequireRole` returns `null` while initializing (blank screen flash)
- Color-only status in several places (mitigated somewhat by pill text)
- Tables: wide min-widths → horizontal scroll without sticky first column / caption
- Landing “Sign Up” is mailto only; Privacy/Terms href `#`
- External Orbitron font from third-party CDN
- Leaflet CSS loaded twice (npm + unpkg)

### Performance gaps

- Fleet data + legacy dashboard poll every **5s** (portal always-on when authenticated)
- Fontsource imports only on one page but packages ship full families
- Dead weight: phosphor, chart.js, react-chartjs-2, leaflet, react-leaflet (bundle risk if tree-shaken poorly / CSS still loaded)
- MapLibre + full map UI on multiple routes (heavy; acceptable if lazy-routed — currently eager imports)
- Framer Motion only on one page but in main dependency graph
- Home hero images: one uses large intrinsic size; floating animations undefined
- `preflight: false` in Tailwind → inconsistent base resets vs hand-rolled `*` box-sizing

---

## f) UX friction & craft gaps (vs Terminal-level bar)

### UX friction

1. **First login lands on Fleet**, but marketing brand doesn’t match portal — trust drop for new clients.
2. **Alert rows don’t deep-link** to `/detail/...` — extra hunting.
3. **Trips create form is dense** (map pick mode + many fields) without progressive disclosure or success celebration.
4. **OTA + Wi-Fi on one page** is powerful but visually dense; SSE connection state is easy to miss.
5. **Admin pages** feel like CRUD scaffolds, not client-facing product surfaces.
6. **Public `/dashboard`** is a footgun (auth bypass appearance, broken styles).
7. **No empty-state CTAs** beyond copy (“No live units yet”) — missing “what do I do next?”
8. **Mobile sidebar** becomes a tall block above content (no drawer/collapse) — poor phone ops UX.
9. **Sign-up is email-only** — fine for B2B, but landing CTA density competes (Login / Sign Up / Contact).

### Craft gaps vs reference (Terminal Industries)

| Terminal-like quality | Current app |
|----------------------|-------------|
| Singular dark-industrial or tightly controlled light system | Mixed light portal + cyan marketing + slate Tailwind island |
| Signature typography + consistent display scale | Broken/unloaded display fonts; Orbitron CDN |
| Motion as narrative (scroll, inlays, glow with purpose) | Motion only on Fleet; Home keyframes missing |
| Modular section rhythm & whitespace | Portal pages feel packed; 14–16px gaps everywhere |
| One icon language | Lucide + custom SVGs + unused Phosphor |
| Premium data moments | Maps are strong; charts/tables still utilitarian |

---

## Prioritized issue list

### High impact

| ID | Issue | Why it matters |
|----|-------|----------------|
| H1 | No unified design tokens / dual CSS+Tailwind systems | Every page redesign will re-fragment without a single source of truth |
| H2 | Brand naming + visual mismatch (Home vs Portal vs title) | Undermines B2B trust on first impression |
| H3 | Missing foundation components (Button, Input, Select, etc.) | Inconsistent states; slow Phase 4; a11y drift |
| H4 | Focus-visible / keyboard system incomplete outside map UI | WCAG AA risk on forms, nav, tables, CTAs |
| H5 | Mobile nav is not a drawer — sidebar stacks full height | Blocks ops on phone/tablet |
| H6 | Orphan `/dashboard` + dead CSS classnames | Confusing product surface; security/UX smell (unauthenticated) |
| H7 | Typography loading broken (Space Grotesk/Inter; Orbitron CDN; Geist page-local) | Landing/portal look unfinished; perf/privacy |
| H8 | Alert → asset deep-link missing | Core incident workflow friction |

### Medium impact

| ID | Issue | Why it matters |
|----|-------|----------------|
| M1 | Duplicated pills/cards/charts | Visual inconsistency; maintenance cost |
| M2 | Dead dependencies (Leaflet stack, chart.js, Phosphor) still in package / CSS | Bundle weight, mental overhead |
| M3 | No skeletons / shared empty / toast patterns | Perceived performance + feedback quality |
| M4 | No `prefers-reduced-motion` | A11y + vestibular safety once motion expands |
| M5 | Landing animations (`animate-float`, `animate-pulse-ring`) undefined | Broken signature motion on hero |
| M6 | Dense Trips / OTA / Admin layouts | Client-facing polish gap |
| M7 | Status color tokens not centralized | Risk of non-AA contrast variants proliferating |
| M8 | 5s global polling with no stale/offline banner pattern beyond local notices | Trust in “live” data |

### Low impact

| ID | Issue | Why it matters |
|----|-------|----------------|
| L1 | `brand` colors in Tailwind unused | Noise in config |
| L2 | Privacy/Terms placeholder links | Polish / compliance optics |
| L3 | `cn()` util is naive (no `clsx`/`tailwind-merge`) | Class conflict bugs as Tailwind usage grows |
| L4 | `components.json` shadcn setup present but almost no `ui/` primitives | Incomplete adoption |
| L5 | AI insight box uses off-palette `#0052cc` | Small brand leak |
| L6 | Document title still “Logistics Co.” | Tab/bookmark professionalism |

---

## Stack notes (for later phases — no changes yet)

- **Keep:** React 18, Vite, React Router 6, Tailwind 3, Framer Motion, Lucide, MapLibre (`components/ui/map.jsx`), Recharts, Axios
- **Justify before adding anything new:** prefer tokens + primitives over new UI kits
- **Candidates to remove after verification (Phase 6):** `@phosphor-icons/react`, `chart.js`, `react-chartjs-2`, `leaflet`, `react-leaflet`, duplicate Leaflet CDN link
- **Assumption:** Phase 2 visual direction will lean Terminal-inspired (confident industrial logistics) adapted to a **light ops console + dark ink accents** so dense data stays readable — not a full dark-mode clone of the marketing site unless you specify otherwise on “continue”

---

## Suggested Phase 4 page priority (preview only)

1. Home (`/`) — first impression  
2. Login (`/login`) — conversion to product  
3. App shell / nav (`AppLayout`) — every authenticated minute  
4. Fleet Overview (`/fleet`) — primary home  
5. Truck Detail — core monitoring moment  
6. Alerts → Analytics → Trips → Trip Detail → OTA → Admin pages  
7. Retire or gate `/dashboard`

---

## Phase 1 deliverable checklist

- [x] Routes inventory  
- [x] Components inventory + usage  
- [x] User flows  
- [x] Design tokens snapshot  
- [x] Inconsistencies  
- [x] UX / a11y / perf friction  
- [x] Prioritized High/Med/Low issues  
- [x] Written to `/docs/design-audit.md`  

**No code was changed in Phase 1** (docs only).
