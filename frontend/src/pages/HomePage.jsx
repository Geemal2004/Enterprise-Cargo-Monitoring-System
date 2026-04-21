import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  Boxes,
  Cpu,
  Gem,
  Lightbulb,
  Network,
  Play,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import robot from "../assets/product.jpeg";
import cubes from "../assets/cubes.jpg";
import adminImage from "../assets/image.png";

/* -------------------- Site Nav -------------------- */
function SiteNav() {
  const links = [
    { label: "Solutions", href: "#solutions" },
    { label: "Industries", href: "#industries" },
    { label: "Customers", href: "#customers" },
    { label: "Contact", href: "#contact" },
  ];
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-ink-foreground">
            <Network className="h-4 w-4" />
          </span>
          CargoMonitor
        </Link>
        <ul className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-elevated sm:inline-flex"
          >
            Login
          </Link>
          <a
            href="#signup"
            className="hidden rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-elevated md:inline-flex"
          >
            Sign Up
          </a>
          <a
            href="#contact"
            className="group inline-flex items-center gap-3 rounded-full bg-foreground/0 pl-4 text-sm font-medium text-ink"
          >
            Contact Us
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-accent-foreground transition-transform group-hover:rotate-45">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </a>
        </div>
      </nav>
    </header>
  );
}

/* -------------------- Hero -------------------- */
function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-gradient-hero  lg:pb-24 lg:pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 mx-auto h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-10">
        <div className="relative">
          <h1 className="text-display text-orbitron text-foreground text-[4vw] leading-[0.88] sm:text-[12vw] lg:text-[5.5rem]">
            Connected Cargo
          </h1>

          <div className="absolute right-0 top-0 hidden h-32 w-44 overflow-hidden rounded-2xl shadow-soft md:block lg:h-40 lg:w-56">
            <img
              src={cubes}
              alt="Stacked metallic warehouse boxes"
              className="h-full w-full object-cover"
              width={768}
              height={768}
            />
            <button
              aria-label="Play product video"
              className="absolute inset-0 grid place-items-center bg-foreground/10 backdrop-blur-[1px] transition hover:bg-foreground/20"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-elevated text-ink shadow-soft">
                <Play className="h-4 w-4 fill-ink" />
              </span>
            </button>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 items-end gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-elevated shadow-soft">
                <ShieldCheck className="h-4 w-4 text-ink" />
              </span>
              <p className="max-w-[14rem] text-sm leading-snug text-muted-foreground">
                Real-time IoT-based tracking and condition monitoring for enterprise logistics.
              </p>
            </div>

            <div className="mt-10">
              <div className="flex items-end gap-3">
                {[
                  { m: "Feb", h: 40 },
                  { m: "Mar", h: 55 },
                  { m: "Apr", h: 72 },
                  { m: "May", h: 110, hi: true },
                ].map((b) => (
                  <div key={b.m} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 rounded-md ${
                        b.hi ? "bg-gradient-accent shadow-glow" : "bg-foreground/10"
                      }`}
                      style={{ height: `${b.h}px` }}
                    />
                    <span className="text-xs text-muted-foreground">{b.m}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <span className="font-display text-3xl font-bold text-ink">24/7</span>
                <span className="text-sm text-muted-foreground">Visibility</span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-ink" />
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-6">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl">
              <div className="absolute inset-0 m-auto h-[90%] w-[90%] rounded-full border border-foreground/10" />
              <div className="absolute inset-0 m-auto h-[70%] w-[70%] rounded-full border border-foreground/10" />
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent">
                <span className="absolute inset-0 rounded-full bg-accent animate-pulse-ring" />
              </div>
              <img
                src={robot}
                alt="Smart cargo gateway and sensor device"
                className="absolute left-1/2 top-1/2 z-10 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 object-contain animate-float sm:h-[72%] sm:w-[72%] lg:h-[76%] lg:w-[76%]"
                width={1536}
                height={1152}
              />
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 text-display text-orbitron text-foreground text-[12vw] leading-[0.88] sm:text-[9vw] lg:text-[5.5rem]">
                Logistics
              </span>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="ml-auto max-w-[14rem] text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Uptime
              </p>
              <p className="font-display text-2xl font-bold text-ink">99.9%</p>
            </div>
            <a
              href="#solutions"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-accent px-8 py-4 font-display text-base font-semibold text-accent-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Learn More
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Intro Band -------------------- */
function IntroBand() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12">
      <div className="relative overflow-hidden bg-gradient-ink p-10 text-ink-foreground lg:col-span-3 lg:p-12">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-accent shadow-glow">
          <Gem className="h-5 w-5 text-accent-foreground" />
        </div>
        <p className="mt-10 text-sm text-ink-foreground/70">
          Real-time delivery condition compliance
        </p>
        <p className="mt-2 font-display text-5xl font-bold tracking-tight">100%</p>
        <a
          href="#customers"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent"
        >
          Read More
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center bg-surface-elevated p-10 text-center lg:col-span-6 lg:p-16">
        <div className="max-w-xl">
          <h2 className="text-display text-3xl text-ink sm:text-4xl lg:text-5xl">
            Providing intelligent IoT cargo tracking for enterprise fleets
          </h2>
          <p className="mt-5 text-base text-muted-foreground">
            As logistics experts, we provide real-time tracking, temperature monitoring, 
            and anomaly detection, ensuring your high-value cargo reaches its destination securely.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden bg-surface lg:col-span-3">
        <img
          src={adminImage}
          alt="System Admin"
          className="h-full w-full object-cover"
          loading="lazy"
          width={768}
          height={1024}
        />
        <div className="absolute right-6 top-6 rounded-xl bg-surface-elevated/90 px-4 py-2 backdrop-blur">
          <p className="font-display text-base font-bold text-ink">System Admin</p>
          <p className="text-xs text-muted-foreground">Cargo Monitor</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Solutions -------------------- */
const solutionItems = [
  {
    icon: Bot,
    title: "Real-time IoT Tracking",
    body: "Continuous GPS tracking and geo-fencing for your entire transport fleet.",
  },
  {
    icon: Cpu,
    title: "Environmental Sensing",
    body: "Monitor temperature, humidity, and shock events during sensitive transit.",
  },
  {
    icon: Network,
    title: "Fleet Dashboard",
    body: "One control panel to monitor hundreds of concurrent trips and vehicles.",
  },
  {
    icon: Workflow,
    title: "Smart Alerts",
    body: "Instant notifications for route deviations and condition limit breaches.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Telemetry",
    body: "End-to-end encrypted MQTT data streams directly from IoT nodes to the cloud.",
  },
  {
    icon: Zap,
    title: "Analytics & Reports",
    body: "Automated insights and historical logs for logistics compliance.",
  },
];

function Solutions() {
  return (
    <section id="solutions" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Solutions
            </p>
            <h2 className="mt-3 text-display text-4xl text-ink sm:text-5xl lg:text-6xl">
              A complete monitoring platform for modern logistics
            </h2>
          </div>
          <p className="max-w-sm text-muted-foreground">
            Hardware, software and IoT sensors — engineered together so your cargo visibility
            scales seamlessly.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {solutionItems.map((it) => (
            <article
              key={it.title}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-accent text-accent-foreground shadow-soft transition-transform duration-500 group-hover:rotate-6">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-ink">{it.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/0 blur-3xl transition-all duration-500 group-hover:bg-accent/30" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- Industries -------------------- */
const industryRows = [
  { name: "Cold Chain Logistics", metric: "100%", note: "temperature compliance" },
  { name: "Pharmaceuticals", metric: "24/7", note: "condition tracking" },
  { name: "High-Value Cargo", metric: "99.9%", note: "route adherence" },
  { name: "Perishable Goods", metric: "−30%", note: "spoilage reduction" },
  { name: "Fleet Management", metric: "Real-time", note: "fleet visibility" },
];

function Industries() {
  return (
    <section id="industries" className="bg-gradient-ink py-24 text-ink-foreground lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              Industries
            </p>
            <h2 className="mt-3 text-display text-4xl sm:text-5xl">
              Built for enterprises that move valuable cargo.
            </h2>
            <p className="mt-6 text-base text-ink-foreground/70">
              From high-value assets to highly regulated cold chains, our monitoring 
              adapts to your cargo — ensuring safety and compliance across the board.
            </p>
          </div>

          <div className="lg:col-span-8">
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {industryRows.map((r) => (
                <li
                  key={r.name}
                  className="group flex items-center justify-between gap-6 py-6 transition-colors hover:bg-white/5"
                >
                  <span className="font-display text-2xl font-semibold sm:text-3xl">
                    {r.name}
                  </span>
                  <span className="flex items-baseline gap-3 text-right">
                    <span className="font-display text-3xl font-bold text-accent">
                      {r.metric}
                    </span>
                    <span className="hidden text-sm text-ink-foreground/60 sm:inline">
                      {r.note}
                    </span>
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

/* -------------------- Customer Options -------------------- */
function CustomerOptions() {
  return (
    <section id="customers" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Customer access
            </p>
            <h2 className="mt-3 text-display text-4xl text-ink sm:text-5xl">
              Start with the option that fits your team
            </h2>
          </div>
          <p className="max-w-sm text-muted-foreground">
            This homepage is marketing-first. Customer access is handled through login and account
            request flows.
          </p>
        </div>

        <div id="signup" className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="rounded-3xl border border-border bg-card p-7 shadow-card">
            <p className="text-sm font-semibold text-muted-foreground">Existing customers</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Login</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Access your dashboard, live fleet telemetry, alerts, and trip monitoring.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ink-foreground transition-transform hover:scale-[1.02]"
            >
              Go to login
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="rounded-3xl border border-border bg-card p-7 shadow-card">
            <p className="text-sm font-semibold text-muted-foreground">New customers</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Sign up</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Request a new customer account for your operations team and onboarding support.
            </p>
            <a
              href="mailto:sales@cargomonitor.com?subject=Customer%20Sign%20Up%20Request"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
            >
              Request sign up
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </article>

          <article className="rounded-3xl border border-border bg-card p-7 shadow-card">
            <p className="text-sm font-semibold text-muted-foreground">Questions</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Contact us</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Talk to our team about demos, pricing, rollout timelines, and integrations.
            </p>
            <a
              href="#contact"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-elevated"
            >
              Open contact section
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

/* -------------------- CTA Footer -------------------- */
function CtaFooter() {
  return (
    <footer id="contact" className="bg-background">
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        <div className="overflow-hidden rounded-3xl bg-gradient-hero p-10 shadow-soft lg:p-16">
          <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Get Started
              </p>
              <h2 className="mt-3 text-display text-4xl text-ink sm:text-5xl lg:text-6xl">
                Ready to secure your cargo?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Deploy our IoT nodes and start tracking your fleet's cargo in real time. 
                Contact us to plan your deployment — free consultation.
              </p>
            </div>
            <a
              href="mailto:hello@cargomonitor.com"
              className="group inline-flex items-center gap-3 rounded-full bg-ink py-4 pl-8 pr-3 font-display text-base font-semibold text-ink-foreground shadow-soft transition-transform hover:scale-[1.02]"
            >
              Request a Demo
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-accent-foreground transition-transform group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
          <p className="font-display text-lg font-bold text-ink">CargoMonitor</p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Enterprise Cargo Monitoring System. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Careers</a>
          </div>
        </div>
      </section>
    </footer>
  );
}

/* -------------------- Page -------------------- */
export default function HomePage() {
  return (
    <main className="landing min-h-screen bg-background">
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
