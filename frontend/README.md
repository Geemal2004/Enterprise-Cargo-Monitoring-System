# Smart Cargo Monitoring Frontend

React + Vite console for **CargoMonitor / Smart Cargo** — fleet telemetry, alerts, trips, OTA, and admin.

## Stack

- React 18 + Vite 5 + React Router 6
- Tailwind CSS 3 + design tokens (`src/styles/tokens.css`)
- Framer Motion (entrance / signature moments)
- MapLibre (`components/ui/map.jsx`)
- Recharts
- Lucide icons + Geist fonts
- Axios

## Design docs

- `/docs/design-audit.md` — Phase 1 inventory
- `/docs/design-system.md` — Control Tower system
- `/docs/phase-4-changelog.md` — page upgrades
- `/docs/phase-5-signature-moments.md` — signature motion
- `/docs/upgrade-summary.md` — full upgrade summary & test plan

## Environment

Create `.env` from `.env.example`:

- `VITE_API_URL=https://vish85521-cargo.hf.space/api`

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run preview
```

## Routes (high level)

| Path | Purpose |
|------|---------|
| `/` | Marketing landing |
| `/login` | Auth |
| `/fleet` | Fleet overview (default after login) |
| `/analytics` | Fleet GPS map |
| `/alerts` | Alerts center |
| `/detail/:truckId/:containerId` | Asset detail |
| `/trips`, `/trips/:tripCode` | Trip ops (role-gated) |
| `/ota` | Wi-Fi + firmware (admin) |
| `/admin/users` | User management |
| `/admin/fleet-manager-assignments` | Super-admin assignments |
| `/dashboard` | Redirects to `/fleet` |
