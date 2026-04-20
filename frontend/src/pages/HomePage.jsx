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
import robot from "../assets/hero-robot.jpg";
import cubes from "../assets/cubes.jpg";
import founder from "../assets/founder.jpg";

/* -------------------- Site Nav -------------------- */
function SiteNav() {
  const links = [
    { label: "Solutions", href: "#solutions" },
    { label: "Industries", href: "#industries" },
    { label: "Customers", href: "#customers" },
  ];
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-ink-foreground">
            <Boxes className="h-4 w-4" />
          </span>
          Enterlogix
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
        <a
          href="#contact"
          className="group inline-flex items-center gap-3 rounded-full bg-foreground/0 pl-4 text-sm font-medium text-ink"
        >
          Get Started
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-accent-foreground transition-transform group-hover:rotate-45">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </a>
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
            The New era
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
                <Lightbulb className="h-4 w-4 text-ink" />
              </span>
              <p className="max-w-[14rem] text-sm leading-snug text-muted-foreground">
                AI-driven warehouse robots for flexible enterprise logistics.
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
                <span className="font-display text-3xl font-bold text-ink">8X</span>
                <span className="text-sm text-muted-foreground">Productivity</span>
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
                alt="Autonomous AI warehouse robot"
                className="relative z-10 h-full w-full object-contain animate-float"
                width={1536}
                height={1152}
              />
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 text-display text-orbitron text-foreground text-[12vw] leading-[0.88] sm:text-[9vw] lg:text-[5.5rem]">
                Warehouse
              </span>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="ml-auto max-w-[14rem] text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                max. Payload
              </p>
              <p className="font-display text-2xl font-bold text-ink">25 KG</p>
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
          Inventory accuracy across deployed fleets
        </p>
        <p className="mt-2 font-display text-5xl font-bold tracking-tight">99.9%</p>
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
            Providing AI-driven flexible warehouse robots for business
          </h2>
          <p className="mt-5 text-base text-muted-foreground">
            As supply chain experts, we&apos;ve transformed fulfillment with AI-driven
            robotics — helping enterprises scale operations safely and efficiently.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden bg-surface lg:col-span-3">
        <img
          src={founder}
          alt="Max Luis, Founder"
          className="h-full w-full object-cover"
          loading="lazy"
          width={768}
          height={1024}
        />
        <div className="absolute right-6 top-6 rounded-xl bg-surface-elevated/90 px-4 py-2 backdrop-blur">
          <p className="font-display text-base font-bold text-ink">Max Luis</p>
          <p className="text-xs text-muted-foreground">Founder</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Solutions -------------------- */
const solutionItems = [
  {
    icon: Bot,
    title: "Autonomous Mobile Robots",
    body: "Self-navigating fleets that pick, sort, and deliver with sub-centimeter precision.",
  },
  {
    icon: Cpu,
    title: "Vision AI",
    body: "Real-time object recognition across SKUs, packaging and damaged goods.",
  },
  {
    icon: Network,
    title: "Fleet Orchestration",
    body: "One control plane to coordinate hundreds of robots across multi-site networks.",
  },
  {
    icon: Workflow,
    title: "WMS Integrations",
    body: "Plug into SAP, Oracle, Manhattan and Blue Yonder in days, not quarters.",
  },
  {
    icon: ShieldCheck,
    title: "Safety Certified",
    body: "ISO 3691-4 compliant, with redundant LIDAR and emergency-stop systems.",
  },
  {
    icon: Zap,
    title: "Rapid Deployment",
    body: "From kickoff to live operations in under 60 days — guaranteed.",
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
              A complete operating system for the modern warehouse
            </h2>
          </div>
          <p className="max-w-sm text-muted-foreground">
            Hardware, software and AI — engineered together so your throughput scales
            without the headcount.
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
  { name: "E-commerce Fulfillment", metric: "+340%", note: "throughput uplift" },
  { name: "Cold Chain & Grocery", metric: "−42%", note: "labor hours / pallet" },
  { name: "Automotive Parts", metric: "99.98%", note: "pick accuracy" },
  { name: "Pharmaceuticals", metric: "GxP", note: "validated workflows" },
  { name: "3PL & Cross-Dock", metric: "<60d", note: "deploy time" },
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
              Built for the operators who move the world.
            </h2>
            <p className="mt-6 text-base text-ink-foreground/70">
              From last-mile fulfillment to highly regulated cold chains, our fleet
              adapts to your floor — not the other way around.
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
                Ready to automate your floor?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Book a 30-minute consultation with our solutions team. We&apos;ll model
                your throughput, ROI and deployment plan — free.
              </p>
            </div>
            <a
              href="mailto:hello@enterlogix.ai"
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
          <p className="font-display text-lg font-bold text-ink">Enterlogix</p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Enterlogix Robotics, Inc. All rights reserved.
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
      <CtaFooter />
    </main>
  );
}
