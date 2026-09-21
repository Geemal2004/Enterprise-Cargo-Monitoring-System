# Upgrade summary — CargoMonitor / Smart Cargo UI

**Project:** IoT cargo B2B console (`frontend/`)  
**Completed:** Phases 1–6 (2026-09-20)  
**Direction:** Control Tower — confident industrial logistics (Terminal Industries craft bar, light ops console)

---

## What changed

### Design system
- Central tokens in `frontend/src/styles/tokens.css` (color, type, space, radius, shadow, motion)
- Tailwind theme mapped to tokens; Geist Sans/Mono loaded globally
- Motion helpers + reduced-motion fallbacks (`lib/motion.js`, CSS)
- Brand naming: **CargoMonitor** (external) / **Smart Cargo** (console)

### Foundation UI (`components/ui/`)
Buttons, inputs, selects, checkbox/switch, modal, dropdown, tooltip, tabs, toast, card/metric, table, badge, alert, spinner/skeleton, empty/error, navigation, signal markers, page transition, scroll signal

### Pages
- Marketing home redesigned (hero, mobile nav, scroll signal)
- Login + auth loading on primitives
- Portal shell with mobile drawer + skip link + route transitions
- Fleet, Alerts, Analytics, Truck Detail, Trips, OTA, Admin headers/surfaces upgraded
- Alert rows deep-link to asset detail
- Legacy `/dashboard` redirects to `/fleet`

### Signature moments
1. Marketing scroll “telemetry scan”
2. Fleet KPI count-up
3. Pulsing map signal pins + live dot
4. Soft portal route dissolve

### Performance / cleanup (Phase 6)
- Removed unused deps: Leaflet, react-leaflet, chart.js, react-chartjs-2, Phosphor
- Removed orphan `DashboardPage`, `AlertPanel`, `RecentChart`, `useDashboardData`
- Dropped Leaflet CDN + marker bootstrap from `main.jsx` / `index.html`
- Lazy-loaded heavy portal routes (Analytics, Trips, Detail, OTA, Admin, Alerts)
- Meta description + theme-color
- `RequireRole` shows spinner instead of blank flash

---

## What to test

### Functional (no regressions)
- [ ] Login → lands on `/fleet`; invalid credentials show error alert
- [ ] Role-gated routes (viewer vs fleet_manager vs admin vs super_admin)
- [ ] Fleet table → View Details → sensors, map, trends, AI summary still work
- [ ] Alerts filters + deep-link to detail
- [ ] Analytics map markers + controls
- [ ] Trips create / start / complete + trip detail path
- [ ] OTA Wi-Fi scan/connect + firmware upload/trigger + SSE chip
- [ ] User create/edit/password reset; fleet manager assignments
- [ ] Sign out clears session
- [ ] `/dashboard` redirects to `/fleet` (then login if needed)

### Visual / responsive
- [ ] 375px — marketing menu; portal hamburger drawer
- [ ] 768px — KPI grids; forms readable
- [ ] 1024px+ — persistent sidebar
- [ ] 1440 / 1920 — portal max-width ~1360; landing not stretched awkwardly

### Accessibility
- [ ] Keyboard: skip link → main; tab through nav, forms, tables, modals
- [ ] Focus rings visible (`:focus-visible`)
- [ ] Screen reader: login errors (`role=alert`), toasts (`aria-live`), switch/checkbox labels
- [ ] `prefers-reduced-motion: reduce` disables float/ping/count-up/route motion
- [ ] Contrast: body text, signal CTAs, status pills (spot-check AA)

### Performance
- [ ] `npm run build` succeeds; check chunk split for lazy routes
- [ ] Home hero image does not cause large CLS (fixed aspect container)
- [ ] Maps load only when those routes are visited
- [ ] Target: Lighthouse Perf ≥90, A11y ≥95 on Home + Fleet (run in Chrome)

### Cross-browser
- [ ] Chromium, Firefox, Safari (MapLibre + SSE)

---

## Follow-ups (optional)

| Item | Priority | Notes |
|------|----------|-------|
| Migrate remaining admin/trips form CSS (`.form-input`, `.table-action`) fully to primitives | Med | Visual consistency |
| Compress/convert landing images to WebP + explicit `width`/`height` everywhere | Med | LCP |
| Sticky first column on wide fleet/alerts tables | Low | Mobile UX |
| Dark theme token set | Low | Not required for ops |
| E2E Playwright smoke for login → fleet → detail | Med | Regression safety |
| Remove remaining hardcoded hex in `index.css` as pages migrate | Low | Token purity |
| Replace default Vite favicon with CargoMonitor mark | Low | Branding |

---

## Key paths

| Area | Path |
|------|------|
| Tokens | `frontend/src/styles/tokens.css` |
| UI kit | `frontend/src/components/ui/` |
| Shell | `frontend/src/components/AppLayout.jsx` |
| Routes | `frontend/src/App.jsx` |
| Audit | `docs/design-audit.md` |
| System | `docs/design-system.md` |

---

## Assumptions carried through

- Light ops console + ink sidebar is correct for long operator sessions
- Steel-teal `#0B6E8F` is the primary signal accent
- No business API contract changes were required for the UI upgrade
- Sign-up remains mailto / admin-provisioned (no in-app registration)

**Phases 1–6 complete.** Ready for stakeholder review and Lighthouse verification on staging.
