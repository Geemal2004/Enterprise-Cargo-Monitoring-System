# Phase 5 — Signature moments

Four brand-defining touches for CargoMonitor / Smart Cargo. All use `transform`/`opacity` only and respect `prefers-reduced-motion`.

| # | Moment | Where | Behavior |
|---|--------|-------|----------|
| 1 | **Telemetry scan** | Marketing home | Fixed 2px signal gradient tracks scroll progress (`ScrollSignal`) — no scroll-jacking |
| 2 | **KPI count-up** | Fleet Overview MetricCards | Numeric values ease from prior → current on load/update (`useCountUp`) |
| 3 | **Signal pins** | Analytics map + Truck detail map | Pulsing steel-teal markers (`SignalMarker`); live green pulse on Fleet “Live link” (`LiveDot`) |
| 4 | **Route dissolve** | Portal shell | Soft opacity/Y entrance on pathname change (`PageTransition`) — does not block clicks |

## Intentionally skipped

- Custom cursor — hurts ops precision and a11y
- Heavy scroll storytelling in the portal — operators need stable controls
- Onboarding wizard — no product signup flow yet (mailto only)

## Files

- `hooks/useCountUp.js`
- `components/ui/signal-marker.jsx`
- `components/ui/page-transition.jsx`
- `components/ui/scroll-signal.jsx`
- Wired in: `HomePage`, `FleetOverviewPage`, `AnalyticsPage`, `TruckMap`, `AppLayout`, `index.css` (`.cm-signal-ping`)
