import ProductShowcase from "@/components/ProductShowcase";
import DemoForm from "@/components/DemoForm";
import ConsentBanner from "@/components/ConsentBanner";
import { useLenis } from "@/hooks/useLenis";
import { trackEvent } from "@/lib/analytics";
import { ScrollSignal } from "@/components/ui/scroll-signal";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Box,
  Building2,
  CheckCircle2,
  Cpu,
  FileJson,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  Menu,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Thermometer,
  Truck,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* Thin-space + true-minus helpers for consistent unit style: "−19.4 °C" */
const TS = " ";
const MINUS = "−";

const NAV_LINKS = [
  { label: "Hardware", href: "#hardware", id: "hardware" },
  { label: "Platform", href: "#platform", id: "platform" },
  { label: "Industries", href: "#industries", id: "industries" },
  { label: "How it works", href: "#how", id: "how" },
  { label: "Security", href: "#security", id: "security" },
  { label: "Contact", href: "#contact", id: "contact" },
];

function CargoMark({ className = "h-5 w-5" }) {
  // Container with a radiating telemetry signal: cargo + connectivity in one glyph.
  return (
    <svg viewBox="-2 -2 36 36" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="13.5" width="18" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="2.1" />
      <path
        d="M8 16.5v6.5M13 16.5v6.5M18 16.5v6.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="23" cy="10" r="2.1" fill="#22d3ee" />
      <path d="M23 5.7A4.3 4.3 0 0 1 27.3 10" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 2A8 8 0 0 1 31 10" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState("");
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(Boolean);
    if (!sections.length || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Primary"
          className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0b1220]/95 px-4 py-3 pl-5 pr-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          <Link to="/" className="flex items-center gap-3 no-underline" aria-label="CargoMonitor home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#22d3ee] via-[#0b6e8f] to-[#0b1220] text-white">
              <CargoMark />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[17px] font-bold tracking-tight text-white">
                CargoMonitor
              </span>
              <span className="mt-0.5 block text-xs font-medium uppercase tracking-[0.08em] text-white/60">
                Enterprise IoT
              </span>
            </span>
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  aria-current={activeId === l.id ? "true" : undefined}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeId === l.id
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2.5 sm:flex">
            <Link
              to="/login"
              className="min-h-[44px] rounded-full px-4 py-2.5 text-sm font-semibold leading-[24px] text-white/85 no-underline transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Link>
            <a
              href="#demo"
              onClick={() => trackEvent("cta_click", { cta: "nav_request_demo" })}
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2 text-sm font-semibold text-[#0b1220] no-underline transition-transform duration-200 hover:scale-[1.02]"
            >
              Request demo
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0b1220] text-white transition-transform duration-200 group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </a>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </nav>

        {open ? (
          <div
            id="mobile-nav"
            className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/95 p-3 shadow-2xl backdrop-blur-xl lg:hidden"
          >
            <ul className="grid">
              {NAV_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    aria-current={activeId === l.id ? "true" : undefined}
                    className={`block min-h-[48px] rounded-xl px-4 py-3 text-[16px] font-semibold leading-[24px] ${
                      activeId === l.id ? "bg-white/15 text-white" : "text-white/90 hover:bg-white/10"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="mt-1 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <Link
                  to="/login"
                  className="min-h-[48px] rounded-xl border border-white/15 px-4 py-3 text-center text-[16px] font-semibold leading-[24px] text-white no-underline"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </Link>
                <a
                  href="#demo"
                  className="min-h-[48px] rounded-xl bg-white px-4 py-3 text-center text-[16px] font-semibold leading-[24px] text-[#0b1220] no-underline"
                  onClick={() => setOpen(false)}
                >
                  Request demo
                </a>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#060b14]" />
      <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-[#0b6e8f]/45 blur-[140px] animate-aurora-a" />
      <div className="absolute right-[-160px] top-[8%] h-[620px] w-[620px] rounded-full bg-[#1e3a8a]/50 blur-[150px] animate-aurora-b" />
      <div className="absolute bottom-[-220px] left-[28%] h-[520px] w-[720px] rounded-full bg-[#06b6d4]/25 blur-[150px] animate-aurora-a" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black_35%,transparent_78%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/70 to-transparent" />
    </div>
  );
}

/*
 * Sample-data telemetry mock. All figures are internally consistent:
 * Jaffna (9.66° N) → Matara (5.95° N); 65% of route ≈ 7.25° N.
 * Gate-out 06:40 + 7 h 48 min elapsed = 14:28 now; 4 h 12 min left; ETA 18:40.
 * Reefer band −22 to −18 °C; reading −19.4 °C sits inside the band.
 */
function LiveTelemetryCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-[#22d3ee]/25 via-transparent to-[#0b6e8f]/30 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <p className="font-mono text-xs tracking-[0.08em] text-white/60">
            control-tower · sample data
          </p>
          <p className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/75">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22d3ee] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
            </span>
            Sample data
          </p>
        </div>

        <div className="grid gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#67e8f9]">
                TRK-042 · Active trip
              </p>
              <p className="mt-1 font-display text-xl font-bold tracking-tight text-white">
                Jaffna <span className="mx-1 text-white/40">→</span> Matara
              </p>
            </div>
            <p className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 font-mono text-xs text-white/80">
              <MapPin className="h-3.5 w-3.5 text-[#67e8f9]" aria-hidden="true" />
              7.25° N, 80.71° E · 4{TS}h{TS}12{TS}min left
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0a1322]/80 p-4">
            <div className="flex items-center justify-between font-mono text-xs text-white/60">
              <span>JAF · 06:40</span>
              <span className="font-semibold text-emerald-300">65% en route</span>
              <span>MAT · 18:40</span>
            </div>
            <div
              className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
              role="img"
              aria-label="Trip progress: 65 percent, gate-out 06:40, ETA 18:40"
            >
              <div className="absolute inset-y-0 left-0 w-[65%] rounded-full bg-gradient-to-r from-[#0b6e8f] via-[#22d3ee] to-[#a5f3fc]" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/60">
              <span>Elapsed 7{TS}h{TS}48{TS}min</span>
              <span>Position as of 14:28</span>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
              <dt className="flex items-center gap-1.5 text-white/60">
                <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.08em]">Temp</span>
              </dt>
              <dd className="mt-1.5 font-display text-2xl font-bold tabular-nums text-white">
                {MINUS}19.4{TS}°C
              </dd>
              <dd className="text-xs text-emerald-300">Band {MINUS}22 to {MINUS}18{TS}°C</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
              <dt className="flex items-center gap-1.5 text-white/60">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.08em]">Humid</span>
              </dt>
              <dd className="mt-1.5 font-display text-2xl font-bold tabular-nums text-white">63{TS}% RH</dd>
              <dd className="text-xs text-white/60">Stable</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
              <dt className="flex items-center gap-1.5 text-white/60">
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.08em]">Shock</span>
              </dt>
              <dd className="mt-1.5 font-display text-2xl font-bold tabular-nums text-white">0.4{TS}g</dd>
              <dd className="text-xs text-emerald-300">No events</dd>
            </div>
          </dl>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/60">
                Last 6{TS}h · temperature
              </p>
              <p className="font-mono text-xs text-[#67e8f9]">{MINUS}19.6{TS}°C avg</p>
            </div>
            <svg viewBox="0 0 320 72" className="mt-2 h-[72px] w-full" role="img" aria-label="Sample temperature trend, average minus 19.6 degrees">
              <defs>
                <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0b6e8f" />
                  <stop offset="60%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#a5f3fc" />
                </linearGradient>
                <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 52 C 30 50, 45 30, 70 34 S 110 58, 140 44 S 190 18, 220 28 S 280 52, 320 30 L320 72 L0 72 Z" fill="url(#sparkfill)" />
              <path d="M0 52 C 30 50, 45 30, 70 34 S 110 58, 140 44 S 190 18, 220 28 S 280 52, 320 30" fill="none" stroke="url(#spark)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="220" cy="28" r="4" fill="#22d3ee" stroke="#060b14" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Proof chips parked clear of card content (desktop only) */}
      <div className="absolute -bottom-8 left-8 z-20 hidden animate-float-slow rounded-2xl border border-white/10 bg-[#0d1728]/95 px-4 py-3 shadow-2xl backdrop-blur-xl lg:block">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">Thresholds held</p>
            <p className="text-xs text-white/60">Reefer band {MINUS}22 to {MINUS}18{TS}°C</p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 right-8 z-20 hidden animate-float-slower rounded-2xl border border-white/10 bg-[#0d1728]/95 px-4 py-3 shadow-2xl backdrop-blur-xl lg:block">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#22d3ee]/15 text-[#67e8f9]">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-sm font-bold text-white">TLS-encrypted stream</p>
            <p className="text-xs text-white/60">Store-and-forward on gaps</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const reduced = useReducedMotion();
  const motionProps = fadeUp(Boolean(reduced));

  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden pb-14 pt-[132px] sm:pt-[148px] lg:pb-20 lg:pt-[168px]">
      <AuroraBackground />
      <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8">
        <motion.div {...motionProps}>
          <p className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-1.5 pl-1.5 pr-4 backdrop-blur-xl">
            <span className="rounded-full bg-gradient-to-r from-[#22d3ee] to-[#0b6e8f] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
              New
            </span>
            <span className="text-sm font-medium text-white/80">
              Control Tower 2.0 — live trips, over-the-air updates and compliance reports in one view
            </span>
          </p>

          <h1 id="hero-heading" className="mt-6 font-display text-[clamp(2.9rem,7.2vw,5.6rem)] font-bold leading-[0.98] tracking-[-0.02em] text-white">
            Freight that
            <span className="block bg-gradient-to-r from-[#a5f3fc] via-[#22d3ee] to-[#2b9bbb] bg-clip-text text-transparent">
              reports itself.
            </span>
          </h1>

          <p className="mt-6 max-w-[62ch] text-[16px] leading-[1.6] text-white/75">
            CargoMonitor is the enterprise IoT control tower for live location, temperature,
            shock and humidity, from gate-out to proof of delivery. Built for teams that
            move regulated cargo and cannot afford a blind mile.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#demo"
              onClick={() => trackEvent("cta_click", { cta: "hero_request_demo" })}
              className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-white px-7 py-4 text-[16px] font-bold text-[#0b1220] no-underline shadow-[0_18px_50px_-12px_rgba(255,255,255,0.45)] transition-transform duration-200 hover:scale-[1.02]"
            >
              Request an enterprise demo
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0b1220] text-white transition-transform duration-200 group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </a>
            <a
              href="#hardware"
              onClick={() => trackEvent("cta_click", { cta: "hero_see_hardware" })}
              className="inline-flex min-h-[56px] items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.06] px-6 py-4 text-[16px] font-semibold text-white no-underline backdrop-blur-xl transition-colors hover:bg-white/[0.12]"
            >
              See the hardware
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-9 flex flex-col gap-4">
            {/* TODO(owner): restore a "Trusted by N teams" line once a customer count is verified. */}
            <p className="text-[16px] text-white/75">
              Purpose-built for cold-chain, pharma and high-value fleets.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[#67e8f9]" aria-hidden="true" /> TLS-encrypted telemetry
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#67e8f9]" aria-hidden="true" /> Tenant-isolated console
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut", delay: reduced ? 0 : 0.1 }}
        >
          <LiveTelemetryCard />
        </motion.div>
      </div>

      <div className="relative mx-auto mt-16 max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: `5${TS}s`, v: "Console refresh link" },
            { k: "TLS", v: "Encrypted device streams" },
            { k: "2 devices", v: "Gateway plus sensor per truck" },
            { k: "1 console", v: "One live record for fleet, QA and customers" },
          ].map((s) => (
            <div key={s.v} className="bg-[#0a1220]/95 px-6 py-5">
              <dt className="order-2 mt-1 text-sm text-white/70">{s.v}</dt>
              <dd className="order-1 font-display text-3xl font-bold tracking-tight text-white">{s.k}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-white/60">
          Capability figures for the standard kit and console. Commercial service levels are agreed in
          your order form.
        </p>
      </div>
    </section>
  );
}

const TRUST_ITEMS = [
  "Cold-chain logistics",
  "Pharmaceuticals",
  "High-value cargo",
  "Port and yard operations",
  "Perishables",
  "Fleet operations",
];

function TrustMarquee() {
  return (
    <section aria-label="Industries served" className="group relative border-y border-white/10 bg-[#080f1c] py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#080f1c] to-transparent sm:w-32" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#080f1c] to-transparent sm:w-32" aria-hidden="true" />
      <div className="overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-10 pr-10 group-hover:[animation-play-state:paused]">
          {TRUST_ITEMS.map((t) => (
            <span key={t} className="flex items-center gap-10 whitespace-nowrap">
              <span className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white/60">
                {t}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]/60" aria-hidden="true" />
            </span>
          ))}
          <span className="flex items-center gap-10" aria-hidden="true">
            {TRUST_ITEMS.map((t) => (
              <span key={`dup-${t}`} className="flex items-center gap-10 whitespace-nowrap">
                <span className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white/60">
                  {t}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]/60" />
              </span>
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  const cards = [
    {
      icon: Radio,
      title: "Live, not batched",
      body: "Readings reach your dashboard in seconds, not in an end-of-day CSV.",
    },
    {
      icon: ShieldCheck,
      title: "Audit-ready",
      body: "Full threshold history, trip ledger and one-click compliance exports.",
    },
    {
      icon: Truck,
      title: "Built for fleet scale",
      body: "Monitor hundreds of concurrent trucks from one calm console.",
    },
  ];
  return (
    <section aria-labelledby="problem-heading" className="bg-[#f5f7fa] py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#0b1220]/12 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">
              Why enterprises switch
            </p>
            <h2 id="problem-heading" className="mt-5 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-[#0b1220]">
              Blind spots cost more than sensors ever will.
            </h2>
          </div>
          <div className="lg:col-span-7">
            <p className="max-w-[62ch] text-[16px] leading-[1.6] text-[#475569]">
              A single temperature excursion can write off an entire pharmaceutical load. One
              missed handoff can delay a retail launch. CargoMonitor connects in-cab gateways
              and container sensors to one multi-tenant console, so quality, fleet and
              customer teams work from the same live record.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {cards.map((c) => (
                <div key={c.title} className="rounded-2xl border border-[#0b1220]/10 bg-white p-6 shadow-[0_10px_30px_-14px_rgba(11,18,32,0.25)]">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0b6e8f]/10 text-[#0b6e8f]">
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-display text-xl font-bold text-[#0b1220]">{c.title}</p>
                  <p className="mt-2 text-[16px] leading-[1.6] text-[#475569]">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PLATFORM_CARDS = [
  {
    icon: MonitorSmartphone,
    title: "Fleet control tower",
    body: "Every truck, container and trip on one calm, filterable screen, built for dispatch walls and laptops alike.",
  },
  {
    icon: Cpu,
    title: "Environmental sensing",
    body: "Temperature, humidity, pressure and shock, sampled at the edge and streamed over TLS.",
  },
  {
    icon: Bell,
    title: "Smart alerts",
    body: "Configurable thresholds, offline-node detection and route-drift escalation before cargo is at risk.",
  },
  {
    icon: Lock,
    title: "Secure by design",
    body: "Isolated tenants, rotating session tokens and encrypted messaging, built for enterprise security review.",
  },
  {
    icon: Activity,
    title: "Analytics and compliance reports",
    body: "Trip ledgers, daily summaries and one-click compliance exports.",
  },
  {
    icon: Zap,
    title: "Over-the-air updates and connectivity",
    body: "Push firmware updates over the air and manage gateway connectivity without dispatching a technician.",
  },
];

function Solutions() {
  const reduced = useReducedMotion();
  return (
    <section id="platform" aria-labelledby="platform-heading" className="relative overflow-hidden bg-[#0b1220] py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 left-1/3 h-[480px] w-[680px] rounded-full bg-[#0b6e8f]/30 blur-[140px]" />
      </div>
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[68ch]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#67e8f9]">Platform</p>
          <h2 id="platform-heading" className="mt-4 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-white">
            One platform for every container, truck and lane.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.6] text-white/70">
            Hardware, firmware and console, designed together so visibility scales with your
            network, not your headcount.
          </p>
        </div>

        <motion.div
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer(Boolean(reduced))}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {PLATFORM_CARDS.map((it) => (
            <motion.article
              key={it.title}
              variants={staggerItem(Boolean(reduced))}
              className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.08]"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#22d3ee]/25 to-[#0b6e8f]/25 text-[#67e8f9] ring-1 ring-white/15">
                <it.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-[22px] font-bold tracking-tight text-white">{it.title}</h3>
              <p className="mt-2.5 text-[16px] leading-[1.6] text-white/70">{it.body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const INDUSTRIES = [
  {
    icon: Thermometer,
    name: "Cold chain",
    problem: "A reefer that drifts a few degrees can spoil a full load before anyone notices.",
    outcome: "Continuous temperature and humidity trace from gate-out to delivery, with threshold alerts in seconds.",
    proof: "Bands and alerts configured per cargo profile.",
  },
  {
    icon: ShieldCheck,
    name: "Pharmaceuticals",
    problem: "Regulators expect an unbroken condition record for every shipment.",
    outcome: "Trip ledger with full threshold history and one-click compliance exports your QA team can file.",
    proof: "Exports formatted for QA filing.",
  },
  {
    icon: Lock,
    name: "High-value cargo",
    problem: "Route deviations and unscheduled stops are discovered after the loss.",
    outcome: "Live route adherence with offline-node detection and escalation before cargo is at risk.",
    proof: "Escalation rules configured per lane.",
  },
  {
    icon: Truck,
    name: "Port and yard",
    problem: "Containers dwell for days with no visibility into conditions or readiness.",
    outcome: "Yard-wide status per container, so dispatch pulls ready units first.",
    proof: "Readiness status per container across the yard.",
  },
];

function Industries() {
  return (
    <section id="industries" aria-labelledby="industries-heading" className="bg-[#f5f7fa] py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[68ch]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">Industries</p>
          <h2 id="industries-heading" className="mt-4 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-[#0b1220]">
            Built for cargo that cannot go dark.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.6] text-[#475569]">
            Four operating profiles, one platform. Thresholds, lanes and reports adapt to
            your freight.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {INDUSTRIES.map((r) => (
            <article key={r.name} className="flex flex-col overflow-hidden rounded-3xl border border-[#0b1220]/10 bg-white shadow-[0_24px_60px_-28px_rgba(11,18,32,0.3)]">
              <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
                <h3 className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight text-[#0b1220]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0b1220]/[0.05] text-[#0b1220]">
                    <r.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  {r.name}
                </h3>
                <p className="text-[16px] leading-[1.6] text-[#475569]">
                  <strong className="font-semibold text-[#0b1220]">Problem: </strong>
                  {r.problem}
                </p>
                <p className="text-[16px] leading-[1.6] text-[#475569]">
                  <strong className="font-semibold text-[#0b1220]">Outcome: </strong>
                  {r.outcome}
                </p>
                <p className="rounded-xl bg-[#f5f7fa] px-4 py-3 text-sm leading-relaxed text-slate-500">
                  {r.proof}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const HOW_STEPS = [
  {
    n: "01",
    icon: Box,
    title: "Install",
    body: "Bolt the sensor node to the container roof and place the gateway in the cab. Units arrive paired to each truck and container ID — four bolts and a power lead, no field configuration.",
  },
  {
    n: "02",
    icon: Radio,
    title: "Connect",
    body: "The gateway joins over GSM or Wi-Fi and streams over TLS. Where coverage drops, readings are stored and synced on reconnect, so the record stays continuous.",
  },
  {
    n: "03",
    icon: ShieldCheck,
    title: "Monitor",
    body: "Watch trips live in Fleet Overview, receive threshold and route alerts, push over-the-air firmware updates, and export compliance reports for QA.",
  },
];

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[68ch] text-center">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">How it works</p>
          <h2 id="how-heading" className="mt-4 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-[#0b1220]">
            From sensor to signed proof in three moves
          </h2>
        </div>
        <ol className="mt-14 grid list-none gap-4 p-0 lg:grid-cols-3">
          {HOW_STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-3xl border border-[#0b1220]/10 bg-[#f7f9fc] p-6 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0b1220] text-white">
                  <s.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="font-display text-5xl font-bold text-[#0b1220]/10" aria-hidden="true">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-[#0b1220]">{s.title}</h3>
              <p className="mt-4 text-[16px] leading-[1.6] text-[#475569]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SECURITY_ITEMS = [
  {
    icon: Building2,
    title: "Tenant isolation",
    body: "Every MQTT topic and database query is scoped to your tenant, so fleets never see each other's data. Verified in the current build: tenant-scoped topics and row-level tenant filtering.",
  },
  {
    icon: Lock,
    title: "Encryption in transit",
    body: "Device streams use MQTT over TLS with optional private-CA pinning. Serve the console behind TLS at your edge — required, not optional.",
  },
  {
    icon: KeyRound,
    title: "Access control",
    body: "Role-scoped routes for admins, fleet managers and viewers, with short-lived access tokens and rotating refresh tokens. Verified in the current build.",
  },
  {
    icon: FileJson,
    title: "Audit logs",
    body: "Administrative actions are written to an audit trail with a dedicated review endpoint. Verified in the current build.",
  },
  {
    icon: ShieldCheck,
    title: "Data retention",
    // TODO(owner): define the retention policy (hot storage, archives, deletion on contract end).
    body: "Retention periods, archives and deletion terms are agreed in your service agreement.",
  },
];

function Security() {
  return (
    <section id="security" aria-labelledby="security-heading" className="bg-[#060b14] py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[68ch]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#67e8f9]">Security and compliance</p>
          <h2 id="security-heading" className="mt-4 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-white">
            Controls your security review can verify.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.6] text-white/70">
            Only claims we can demonstrate are listed here.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SECURITY_ITEMS.map((it) => (
            <article key={it.title} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#22d3ee]/15 text-[#67e8f9]">
                <it.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-white">{it.title}</h3>
              <p className="mt-2.5 text-[16px] leading-[1.6] text-white/70">{it.body}</p>
            </article>
          ))}
          <article className="rounded-3xl border border-[#22d3ee]/25 bg-[#22d3ee]/[0.08] p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#0b1220]">
              <Globe className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-display text-xl font-bold text-white">Review pack</h3>
            <p className="mt-2.5 text-[16px] leading-[1.6] text-white/70">
              Ask for the security review pack in your demo call. We claim no
              certifications we do not hold.
            </p>
            <a href="#demo" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-white underline underline-offset-4">
              Request the pack <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  return (
    <section id="integrations" aria-labelledby="integrations-heading" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">Integrations and API</p>
            <h2 id="integrations-heading" className="mt-4 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-[#0b1220]">
              Your systems read the same live record.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.6] text-[#475569]">
              Devices publish over MQTT. Your ERP, WMS or data lake reads over REST, and QA
              takes compliance exports.
            </p>
            <ul className="mt-6 grid gap-3">
              {[
                "MQTT topics per tenant, truck and container",
                "REST endpoints for latest readings, history, alerts and trips",
                "Compliance exports for QA and customers",
              ].map((li) => (
                <li key={li} className="flex items-start gap-2.5 text-[16px] font-medium leading-[1.5] text-[#334155]">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#0b6e8f]" aria-hidden="true" />
                  {li}
                </li>
              ))}
            </ul>
          </div>
          <figure className="overflow-hidden rounded-3xl border border-[#0b1220]/10 bg-white shadow-[0_24px_60px_-28px_rgba(11,18,32,0.3)]">
            <img
              src="/dashboard.png"
              width={1359}
              height={624}
              alt="Fleet Overview console showing trucks, alerts and fleet status table"
              loading="lazy"
              className="h-auto w-full object-cover"
            />
            <figcaption className="border-t border-[#0b1220]/10 px-6 py-4 text-sm leading-relaxed text-slate-500">
              Fleet Overview console — the same live record your systems read.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function PilotProof() {
  return (
    <section aria-labelledby="pilot-heading" className="bg-[#f5f7fa] py-24 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-3xl bg-[#0b1220] p-8 sm:p-12 lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#67e8f9]">Pilot programme</p>
            <h2 id="pilot-heading" className="mt-3 font-display text-[clamp(1.75rem,1.4rem+2vw,2.5rem)] font-bold tracking-tight text-white">
              Start with a pilot, not a purchase order.
            </h2>
            <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.6] text-white/70">
              One lane, pre-paired kit, success criteria agreed in writing.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {["Pre-paired kit shipped", "Live in days on one lane", "Go / no-go on real data"].map((t) => (
                <li key={t} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-[15px] font-medium text-white/85">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-3xl border border-[#0b6e8f]/25 bg-[#e6f3f8] p-8 lg:col-span-4">
            <div>
              <Workflow className="h-6 w-6 text-[#0b6e8f]" aria-hidden="true" />
              <p className="mt-3 font-display text-2xl font-bold text-[#0b1220]">What you get in week one</p>
              <p className="mt-2 text-[16px] leading-[1.6] text-[#475569]">
                Gateway and sensor fitted, console provisioned, first trip ledger closed with
                QA-ready exports.
              </p>
            </div>
            <a
              href="#demo"
              onClick={() => trackEvent("cta_click", { cta: "pilot_scope_call" })}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#0b1220] px-6 text-[16px] font-bold text-white no-underline"
            >
              Scope a pilot <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "How long does installation take?",
    a: "Each unit fits with four bolts and a power lead, and pairs arrive pre-provisioned to your truck and container IDs. A single pilot lane is typically live within days of the kit arriving. Rollout rates for larger fleets are agreed when we scope your rollout.",
  },
  {
    q: "What happens where there is no network coverage?",
    a: "The gateway stores readings locally and syncs them on reconnect, so the trip record stays continuous. Offline nodes are flagged in the console with the time of their last reading.",
  },
  {
    q: "How are the units powered? Is there a battery?",
    a: "Units run on truck and container power with no driver action required. If your use case needs backup power, we cover it when scoping your pilot.",
  },
  {
    q: "Who owns our telemetry data?",
    a: "You do. Data is stored in tenant-isolated storage and processed under your service agreement, which also defines retention periods and subprocessors.",
  },
  {
    q: "What service levels do you offer?",
    a: "Uptime, support hours and response times are agreed in your order form — request the current standard terms on your demo call.",
  },
  {
    q: "How is pricing structured?",
    a: "Pricing is quoted per fleet after a scoping call — it depends on unit count, lanes and support tier.",
  },
  {
    q: "Which cargo types are supported?",
    a: "Cold chain, pharmaceuticals, high-value cargo, perishables, and port and yard operations. Thresholds and reports are configured per cargo profile.",
  },
  {
    q: "What are the contract and pilot terms?",
    a: "Pilots run against written success criteria; full terms, including hardware responsibilities and support hours, are agreed before equipment ships. See the terms page for the baseline.",
  },
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">FAQ</p>
        <h2 id="faq-heading" className="mt-4 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-[#0b1220]">
          Buyer questions, answered plainly.
        </h2>
        <div className="mt-10 grid gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>
                <span>{f.q}</span>
              </summary>
              <p className="faq-answer">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function StartPaths() {
  const cards = [
    {
      eyebrow: "Existing customers",
      title: "Operations sign-in",
      body: "Live fleet telemetry, alerts, trips, over-the-air updates and admin controls.",
      cta: "Sign in",
      to: "/login",
      primary: true,
      footnote: "Role-scoped access",
    },
    {
      eyebrow: "New customers",
      title: "Scope a pilot",
      body: "One lane, pre-paired kit and success criteria in writing — live in days.",
      cta: "Request an enterprise demo",
      href: "#demo",
      footnote: "We reply within one business day",
    },
    {
      eyebrow: "Procurement and QA",
      title: "Talk to sales",
      body: "Pricing, service levels, security review and rollout planning.",
      cta: "Contact sales",
      href: "#contact",
      footnote: "071 162 5588",
    },
  ];

  return (
    <section id="customers" aria-labelledby="start-heading" className="bg-[#f5f7fa] py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">Start</p>
        <h2 id="start-heading" className="mt-3 max-w-[68ch] font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-[#0b1220]">
          Start with the path that fits your team
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className={`flex flex-col rounded-3xl border p-6 sm:p-8 ${
                card.primary
                  ? "border-transparent bg-[#0b1220] text-white"
                  : "border-[#0b1220]/10 bg-white"
              }`}
            >
              <p className={`text-xs font-bold uppercase tracking-[0.08em] ${card.primary ? "text-[#67e8f9]" : "text-[#0b6e8f]"}`}>
                {card.eyebrow}
              </p>
              <h3 className={`mt-2.5 font-display text-[28px] font-bold tracking-tight ${card.primary ? "text-white" : "text-[#0b1220]"}`}>
                {card.title}
              </h3>
              <p className={`mt-3 flex-1 text-[16px] leading-[1.6] ${card.primary ? "text-white/70" : "text-[#475569]"}`}>
                {card.body}
              </p>
              {card.to ? (
                <Link
                  to={card.to}
                  className="mt-7 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-6 text-[16px] font-bold text-[#0b1220] no-underline"
                >
                  {card.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <a
                  href={card.href}
                  onClick={() => trackEvent("cta_click", { cta: card.cta })}
                  className={`mt-7 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[16px] font-bold no-underline ${
                    card.primary
                      ? "bg-white text-[#0b1220]"
                      : "bg-[#0b1220] text-white"
                  }`}
                >
                  {card.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
              <p className={`mt-4 text-center text-sm ${card.primary ? "text-white/60" : "text-slate-500"}`}>
                {card.footnote}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFooter() {
  return (
    <footer id="contact" aria-labelledby="contact-heading" className="bg-[#060b14] pb-28 pt-20 md:pb-10">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 rounded-[32px] border border-white/10 bg-gradient-to-br from-[#10283c] via-[#0b1a2e] to-[#070d18] p-8 sm:p-12 lg:grid-cols-2 lg:p-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#a5f3fc]">
              Contact
            </p>
            <h2 id="contact-heading" className="mt-5 font-display text-[clamp(2rem,1.6rem+2.4vw,3rem)] font-bold tracking-[-0.02em] text-white">
              Ready to secure your next shipment?
            </h2>
            <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.6] text-white/70">
              Tell us about your lanes and cargo. We reply within one business day. Prefer to
              talk? Call{" "}
              <a href="tel:+94711625588" className="font-bold text-white underline decoration-[#22d3ee]/60 underline-offset-4">
                071 162 5588
              </a>{" "}
              or email{" "}
              <a href="mailto:geemalmuthugala@gmail.com?subject=Enterprise%20demo%20request" className="font-bold text-white underline decoration-[#22d3ee]/60 underline-offset-4">
                geemalmuthugala@gmail.com
              </a>
              .
            </p>
            <ul className="mt-6 grid gap-3">
              {["Pilot scoped in days, not quarters", "Security review pack on request", "Hardware, onboarding and support included"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[16px] text-white/80">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div id="demo" className="scroll-mt-28 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h3 className="font-display text-2xl font-bold text-white">Request an enterprise demo</h3>
            <p className="mb-6 mt-2 text-[16px] text-white/70">We reply within one business day.</p>
            <DemoForm />
          </div>
        </div>

        <nav aria-label="Footer" className="mt-14 grid gap-10 border-t border-white/10 pt-10 md:grid-cols-4">
          <div>
            <p className="flex items-center gap-2.5 font-display text-lg font-bold text-white">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white">
                <CargoMark className="h-5 w-5" />
              </span>
              CargoMonitor
            </p>
            <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-white/60">
              Enterprise IoT cargo monitoring — gateway, sensor node and console.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/50">Product</p>
            <ul className="mt-4 grid gap-1">
              {[
                ["Hardware", "#hardware"],
                ["Platform", "#platform"],
                ["Industries", "#industries"],
                ["Integrations and API", "#integrations"],
                ["Security", "#security"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="inline-block min-h-[44px] py-2.5 text-[16px] text-white/75 hover:text-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/50">Console</p>
            <ul className="mt-4 grid gap-1">
              <li><Link to="/login" className="inline-block min-h-[44px] py-2.5 text-[16px] text-white/75 hover:text-white">Sign in</Link></li>
              <li><a href="#demo" className="inline-block min-h-[44px] py-2.5 text-[16px] text-white/75 hover:text-white">Request a demo</a></li>
              <li><a href="#customers" className="inline-block min-h-[44px] py-2.5 text-[16px] text-white/75 hover:text-white">Ways to start</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/50">Legal</p>
            <ul className="mt-4 grid gap-1">
              <li><Link to="/privacy" className="inline-block min-h-[44px] py-2.5 text-[16px] text-white/75 hover:text-white">Privacy notice</Link></li>
              <li><Link to="/terms" className="inline-block min-h-[44px] py-2.5 text-[16px] text-white/75 hover:text-white">Terms of use</Link></li>
            </ul>
          </div>
        </nav>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} CargoMonitor. All rights reserved.</p>
          <p>Illustrations and console captures on this page show sample data unless stated.</p>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060b14]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <a
          href="#demo"
          onClick={() => trackEvent("cta_click", { cta: "sticky_mobile_demo" })}
          className="flex min-h-[52px] items-center justify-center rounded-full bg-white text-[16px] font-bold text-[#0b1220] no-underline"
        >
          Request an enterprise demo
        </a>
      </div>

      <style>{`
        @keyframes aurora-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,40px) scale(1.12); } }
        @keyframes aurora-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-70px,30px) scale(1.08); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-aurora-a { animation: aurora-a 14s ease-in-out infinite; }
        .animate-aurora-b { animation: aurora-b 18s ease-in-out infinite; }
        .animate-marquee { animation: marquee 30s linear infinite; }
        .animate-float-slow { animation: float-slow 5s ease-in-out infinite; }
        .animate-float-slower { animation: float-slow 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-aurora-a, .animate-aurora-b, .animate-marquee, .animate-float-slow, .animate-float-slower { animation: none !important; }
        }
      `}</style>
    </footer>
  );
}

export default function HomePage() {
  useLenis();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <main id="main-content" className="landing min-h-screen bg-[#060b14]">
        <ScrollSignal />
        <SiteNav />
        <Hero />
        <TrustMarquee />
        <Manifesto />
        <ProductShowcase />
        <Solutions />
        <Industries />
        <HowItWorks />
        <Security />
        <Integrations />
        <PilotProof />
        <StartPaths />
        <Faq />
        <CtaFooter />
        <ConsentBanner />
      </main>
    </>
  );
}
