# Phase 4 — Page upgrade changelog

Per-page notes from the Control Tower visual upgrade. Business logic and routes unchanged (except `/dashboard` redirect).

| Page | What changed | Why |
|------|----------------|-----|
| **Home** (`/`) | Reworked hero (brand + headline + CTAs + product visual), mobile nav, motion with reduced-motion, cleaned solutions/industries/access/contact, SiteFooter | First impression; Terminal-caliber clarity; remove hero clutter |
| **Login** | Already on primitives (Phase 3); left as conversion surface | Consistency with system |
| **App shell** | Mobile drawer nav, skip link, CargoMonitor eyebrow, desktop sidebar unchanged structurally | Fix stacked-sidebar mobile friction (audit H5) |
| **Fleet Overview** | PageHeader, MetricCards, Alert, live status strip, Card table shell, motion presets | Align with design system; clearer ops home |
| **Truck Detail** | Empty/loading/error using primitives; mono IDs; Alert for fallback; Button back link | Clearer asset identity and recovery paths |
| **Alerts** | Phase 3 + deep-links (retained) | Incident → detail flow |
| **Analytics** | Overlay hierarchy, signal markers, spinner overlay, location badge | Spatial control-tower feel |
| **Trips** | Typography hierarchy on header | Match page rhythm |
| **Trip Detail** | Status pill tone fix (`pill-info`) | Broken/neutral class |
| **OTA** | Header + live SSE connection chip | Progress feedback for device ops |
| **User Mgmt / Assignments** | Admin eyebrow hierarchy | Consistent admin chrome |
| **Dashboard** (`/dashboard`) | Redirects to `/fleet` | Retire orphan unauthenticated surface (audit H6) |

## Responsive intent

- **375px:** Marketing mobile menu; portal hamburger drawer; stacked headers
- **768px:** Two-column KPI grids; drawer until `lg`
- **1024px+:** Persistent sidebar + content grid
- **1440–1920:** Portal max-width 1360; marketing max-w-7xl
