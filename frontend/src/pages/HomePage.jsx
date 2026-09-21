import { SiteFooter } from "@/components/ui/navigation";
import { ScrollSignal } from "@/components/ui/scroll-signal";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Cpu,
  Menu,
  Network,
  ShieldCheck,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import robot from "/containernode.jpg";

const NAV_LINKS = [
  { label: "Solutions", href: "#solutions" },
  { label: "Industries", href: "#industries" },
  { label: "Access", href: "#customers" },
  { label: "Contact", href: "#contact" },
];

function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10"
        aria-label="Marketing"
      >
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-ink no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-[color:var(--cm-text-inverse)]">
            <Network className="h-4 w-4" aria-hidden="true" />
          </span>
          CargoMonitor
        </Link>

        <ul className="hidden items-center gap-10 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="text-sm font-medium text-[color:var(--cm-text-secondary)] transition-colors duration-fast hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 sm:flex">
          <Link
            to="/login"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:bg-[color:var(--cm-surface)]"
          >
            Login
          </Link>
          <a
            href="#contact"
            className="group inline-flex items-center gap-2 rounded-full bg-ink py-2 pl-4 pr-2 text-sm font-semibold text-[color:var(--cm-text-inverse)] no-underline"
          >
            Request demo
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-accent text-accent-foreground transition-transform duration-fast group-hover:rotate-45">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </a>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-[color:var(--cm-surface)] text-ink md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-nav"
          className="border-b border-border bg-[color:var(--cm-surface)] px-6 py-4 shadow-md md:hidden"
        >
          <ul className="grid gap-3">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="block py-2 text-sm font-semibold text-ink"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link to="/login" className="block py-2 text-sm font-semibold text-signal no-underline" onClick={() => setOpen(false)}>
                Login
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  const reduced = useReducedMotion();
  const motionProps = fadeUp(Boolean(reduced));

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-gradient-hero pb-16 pt-28 lg:justify-center lg:pb-24 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(11,110,143,0.12),transparent_55%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl items-end gap-10 px-6 lg:grid-cols-12 lg:gap-8 lg:px-10">
        <motion.div className="lg:col-span-5" {...motionProps}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            CargoMonitor
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,4.75rem)] font-bold leading-[0.92] tracking-[-0.04em] text-ink">
            Connected cargo.
            <span className="mt-1 block text-signal">Total visibility.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--cm-text-secondary)]">
            Real-time IoT tracking and condition monitoring for enterprise logistics fleets.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-[color:var(--cm-text-inverse)] no-underline transition-transform duration-fast hover:scale-[1.02]"
            >
              Request a demo
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--cm-surface)] px-6 py-3.5 text-sm font-semibold text-ink no-underline"
            >
              Customer login
            </Link>
          </div>
          <dl className="mt-10 flex flex-wrap gap-8">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Visibility</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-ink">24/7</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Uptime</dt>
              <dd className="mt-1 font-display text-2xl font-bold text-ink">99.9%</dd>
            </div>
          </dl>
        </motion.div>

        <motion.div
          className="relative lg:col-span-7"
          initial={reduced ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduced ? 0 : 0.7, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : 0.08 }}
        >
          <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl">
            <div className="absolute inset-0 m-auto h-[88%] w-[88%] rounded-full border border-foreground/10" />
            <div className="absolute inset-0 m-auto h-[68%] w-[68%] rounded-full border border-foreground/10" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal">
              <span className="absolute inset-0 rounded-full bg-signal animate-pulse-ring" />
            </div>
            <img
              src={robot}
              alt="Smart cargo gateway and sensor device"
              className="absolute left-1/2 top-1/2 z-10 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain animate-float"
              width={1536}
              height={1152}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function IntroBand() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12" aria-label="Platform overview">
      <div className="relative overflow-hidden bg-gradient-ink p-10 text-[color:var(--cm-text-inverse)] lg:col-span-4 lg:p-14">
        <p className="text-sm text-white/70">Condition compliance in transit</p>
        <p className="mt-3 font-display text-5xl font-bold tracking-tight">100%</p>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
          Temperature, humidity, shock, and GPS — monitored continuously from gate to dock.
        </p>
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-signal/25 blur-3xl" />
      </div>

      <div className="flex items-center bg-[color:var(--cm-surface)] p-10 lg:col-span-5 lg:p-16">
        <div className="max-w-lg">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Intelligent IoT monitoring for fleets that cannot afford blind spots.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            CargoMonitor gives operations teams a single control tower for live telemetry,
            alerts, and trip integrity — built for cold chain, pharma, and high-value cargo.
          </p>
        </div>
      </div>

      <div className="relative min-h-[280px] overflow-hidden bg-[color:var(--cm-surface-muted)] lg:col-span-3">
        <img
          src="/node1.jpeg"
          alt="Cargo sensor node hardware"
          className="h-full w-full object-cover"
          loading="lazy"
          width={768}
          height={1024}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-5">
          <p className="font-display text-base font-bold text-white">Edge hardware</p>
          <p className="text-xs text-white/70">Gateway + container nodes</p>
        </div>
      </div>
    </section>
  );
}

const solutionItems = [
  {
    icon: Network,
    title: "Fleet control tower",
    body: "One workspace for concurrent trucks, containers, and trips.",
  },
  {
    icon: Cpu,
    title: "Environmental sensing",
    body: "Temperature, humidity, pressure, and shock events in transit.",
  },
  {
    icon: Workflow,
    title: "Smart alerts",
    body: "Threshold breaches and route issues surface before cargo is lost.",
  },
  {
    icon: ShieldCheck,
    title: "Secure telemetry",
    body: "Encrypted streams from IoT nodes into your tenant console.",
  },
  {
    icon: Zap,
    title: "Analytics & reports",
    body: "Historical trends and day summaries for compliance teams.",
  },
  {
    icon: ArrowUpRight,
    title: "OTA & connectivity",
    body: "Push firmware and manage gateway Wi‑Fi without truck rolls.",
  },
];

function Solutions() {
  const reduced = useReducedMotion();

  return (
    <section id="solutions" className="bg-[color:var(--cm-canvas)] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Solutions
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              The operating surface for modern cargo
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Hardware, firmware, and console — engineered together so visibility scales with your network.
          </p>
        </div>

        <motion.div
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer(Boolean(reduced))}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {solutionItems.map((it) => (
            <motion.article
              key={it.title}
              variants={staggerItem(Boolean(reduced))}
              className="group rounded-2xl border border-border bg-[color:var(--cm-surface)] p-7 shadow-sm transition-shadow duration-moderate hover:shadow-md"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-signal-muted text-signal">
                <it.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-ink">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const industryRows = [
  { name: "Cold Chain Logistics", metric: "100%", note: "temperature compliance" },
  { name: "Pharmaceuticals", metric: "24/7", note: "condition tracking" },
  { name: "High-Value Cargo", metric: "99.9%", note: "route adherence" },
  { name: "Perishable Goods", metric: "−30%", note: "spoilage reduction" },
  { name: "Fleet Management", metric: "Live", note: "fleet visibility" },
];

function Industries() {
  return (
    <section id="industries" className="bg-gradient-ink py-24 text-[color:var(--cm-text-inverse)] lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:#5ec8e8]">
              Industries
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Built for cargo that cannot go dark.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-white/70">
              From regulated cold chains to high-value assets, monitoring adapts to your freight profile.
            </p>
          </div>
          <div className="lg:col-span-8">
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {industryRows.map((r) => (
                <li
                  key={r.name}
                  className="flex items-center justify-between gap-6 py-6 transition-colors duration-fast hover:bg-white/5"
                >
                  <span className="font-display text-xl font-semibold sm:text-2xl">{r.name}</span>
                  <span className="flex items-baseline gap-3 text-right">
                    <span className="font-display text-2xl font-bold text-[color:#5ec8e8] sm:text-3xl">
                      {r.metric}
                    </span>
                    <span className="hidden text-sm text-white/55 sm:inline">{r.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomerOptions() {
  const cards = [
    {
      eyebrow: "Existing customers",
      title: "Login",
      body: "Access live fleet telemetry, alerts, trips, and admin controls.",
      cta: "Go to login",
      to: "/login",
      primary: true,
    },
    {
      eyebrow: "New customers",
      title: "Request access",
      body: "Tell us about your fleet and we’ll provision a tenant for your team.",
      cta: "Email sign-up request",
      href: "mailto:geemalmuthugala@gmail.com?subject=Customer%20Sign%20Up%20Request",
    },
    {
      eyebrow: "Questions",
      title: "Talk to us",
      body: "Demos, pricing, rollout timelines, and integration planning.",
      cta: "Open contact",
      href: "#contact",
    },
  ];

  return (
    <section id="customers" className="bg-[color:var(--cm-canvas)] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Customer access
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Start with the path that fits your team
        </h2>

        <div id="signup" className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="flex flex-col rounded-2xl border border-border bg-[color:var(--cm-surface)] p-7 shadow-sm"
            >
              <p className="text-sm font-semibold text-muted-foreground">{card.eyebrow}</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-ink">{card.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              {card.to ? (
                <Link
                  to={card.to}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-[color:var(--cm-text-inverse)] no-underline transition-transform duration-fast hover:scale-[1.02]"
                >
                  {card.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <a
                  href={card.href}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-ink no-underline transition-colors hover:bg-[color:var(--cm-surface-muted)]"
                >
                  {card.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFooter() {
  return (
    <footer id="contact" className="bg-[color:var(--cm-canvas)]">
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="overflow-hidden rounded-2xl border border-border bg-gradient-hero p-10 shadow-md lg:p-14">
          <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Get started
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                Ready to secure your cargo?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Deploy IoT nodes and start tracking in real time. Call{" "}
                <a href="tel:+94711625588" className="font-semibold text-ink">
                  071 162 5588
                </a>{" "}
                or request a demo.
              </p>
            </div>
            <a
              href="mailto:geemalmuthugala@gmail.com?subject=Demo%20Request"
              className="group inline-flex items-center gap-3 rounded-full bg-ink py-3.5 pl-7 pr-2.5 font-display text-base font-semibold text-[color:var(--cm-text-inverse)] no-underline shadow-sm transition-transform duration-fast hover:scale-[1.02]"
            >
              Request a demo
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-accent-foreground transition-transform duration-fast group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>

        <SiteFooter
          className="mt-12"
          links={[
            { label: "Privacy", href: "mailto:geemalmuthugala@gmail.com?subject=Privacy" },
            { label: "Terms", href: "mailto:geemalmuthugala@gmail.com?subject=Terms" },
          ]}
        />
      </section>
    </footer>
  );
}

export default function HomePage() {
  return (
    <main className="landing min-h-screen bg-[color:var(--cm-canvas)]">
      <ScrollSignal />
      <SiteNav />
      <Hero />
      <IntroBand />
      <Solutions />
      <Industries />
      <CustomerOptions />
      <CtaFooter />
    </main>
  );
}
