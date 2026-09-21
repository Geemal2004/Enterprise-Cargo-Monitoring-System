import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUpRight, Box, CheckCircle2, MonitorSmartphone, Radio, Antenna } from "lucide-react";
import { useRef, useState } from "react";

// TODO(owner): enclosures carry third-party "Polycrome" branding (MP025 visible in
// photos). Confirm white-label plan before launch, and keep part numbers identical
// across photos, chips and the spec sheet. Studio kit photo is soft — replace with
// a high-resolution original (min 2x display size).
const CHAPTERS = [
  {
    id: "gateway",
    index: "01",
    kicker: "Gateway · truck cab",
    title: "Small box, big uplink.",
    body: "Mounted on the dashboard, the gateway collects the sensor stream and forwards it over TLS to your platform, even through coverage gaps.",
    image: "/node1.jpeg",
    width: 832,
    height: 1258,
    alt: "Gateway unit with black GSM antenna mounted on a truck dashboard with the road visible through the windscreen",
    caption: "Field install: gateway on the dashboard, antenna upright.",
    chip: "Gateway · IP65",
    bullets: [
      "GSM and Wi-Fi uplink, encrypted with TLS",
      "Stores readings offline and syncs on reconnect",
      "Powered by the truck, with no driver action required",
    ],
    icon: Radio,
  },
  {
    id: "sensor",
    index: "02",
    kicker: "Sensor · container node",
    title: "Eyes inside the box.",
    body: "Fitted to the container roof, the sensor node measures temperature, humidity and shock through its vented window, reporting the container's true conditions.",
    image: "/node2.jpeg",
    width: 685,
    height: 588,
    alt: "Container sensor node with mesh sensing window bolted to the metal roof inside a freight container",
    caption: "Field install: sensor bolted to the container roof.",
    chip: "Sensor node · IP65",
    bullets: [
      "Temperature, humidity and shock sensing",
      "IP65 enclosure with vibration-resistant mount",
      "Sealed cable glands for container power",
    ],
    icon: Box,
  },
  {
    id: "system",
    index: "03",
    kicker: "System · paired together",
    title: "Two devices, one source of truth.",
    body: "The sensor node and gateway arrive paired for each truck, so installation is four bolts and a power lead, with no field configuration.",
    image: "/containernode.jpg",
    width: 530,
    height: 355,
    alt: "Product kit: container sensor node with mesh window beside the gateway unit with antenna",
    caption: "Product kit: sensor node (mesh window) with gateway (antenna).",
    chip: "Paired kit · four-bolt install",
    bullets: [
      "Gateway aggregates node data locally",
      "Pre-provisioned to each truck and container ID",
      "Installs in minutes and survives washdowns",
    ],
    icon: Antenna,
  },
  {
    id: "dashboard",
    index: "04",
    kicker: "Console · control tower",
    title: "See every reading the moment it lands.",
    body: "Every packet appears in Fleet Overview: live link status, trip ledger, alerts and over-the-air updates, all exportable by your QA team.",
    image: "/dashboard.png",
    width: 1359,
    height: 624,
    alt: "CargoMonitor Fleet Overview console showing trucks, alerts and fleet status table",
    caption: "Fleet Overview console with live fleet status.",
    chip: "Console · Fleet Overview",
    bullets: [
      "Live link status, fleet overview and trip ledger",
      "Alerts and OTA firmware updates from one console",
      "One-click compliance exports",
    ],
    icon: MonitorSmartphone,
  },
];

export function ProductShowcase() {
  const sectionRef = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start center", "end center"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(v * CHAPTERS.length)));
    setActive((prev) => (prev === next ? prev : next));
  });

  const current = CHAPTERS[active];

  return (
    <section id="hardware" ref={sectionRef} aria-labelledby="hardware-heading" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[68ch]">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#0b1220]/12 bg-[#f3f5f8] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#0b6e8f]">
            Hardware
          </p>
          <h2 id="hardware-heading" className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-[#0b1220] sm:text-5xl">
            Two devices. One continuous record.
          </h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.6] text-[#475569]">
            Field-proven hardware, photographed in real installations. Everything your
            fleet team needs to fit is in the kit.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* Sticky media — desktop only */}
          <div className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-[#0b1220]/10 bg-[#0b1220] shadow-[0_36px_90px_-30px_rgba(11,18,32,0.55)]">
              <div className="relative aspect-[4/3] w-full">
                <AnimatePresence mode="popLayout">
                  <motion.img
                    key={current.id}
                    src={current.image}
                    width={current.width}
                    height={current.height}
                    alt={current.alt}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading={active === 0 ? "eager" : "lazy"}
                  />
                </AnimatePresence>
              </div>
              {/* Caption bar beneath the image — never over the product */}
              <div className="border-t border-white/10 bg-[#0d1728] px-6 py-5">
                <p className="font-mono text-xs uppercase tracking-[0.08em] text-[#67e8f9]">
                  {current.index} / 04 · {current.chip}
                </p>
                <p className="mt-1.5 text-[16px] leading-[1.6] text-white/85">{current.caption}</p>
                <div className="mt-4 flex items-center gap-2" role="group" aria-label="Hardware chapters">
                  {CHAPTERS.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        document
                          .getElementById(`showcase-${c.id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }
                      aria-label={`Show ${c.title}`}
                      aria-current={i === active ? "true" : undefined}
                      className="flex min-h-[44px] flex-1 items-center"
                    >
                      <span
                        className={`block h-1.5 w-full overflow-hidden rounded-full ${
                          i === active ? "bg-white/20" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`block h-full rounded-full bg-gradient-to-r from-[#67e8f9] to-[#0b6e8f] transition-all duration-500 ${
                            i <= active ? "w-full" : "w-0"
                          }`}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-500">
              Hardware and console photographed in real use. Yard imagery elsewhere on this
              page is illustrative.
            </p>
          </div>

          {/* Chapters */}
          <div className="grid content-start gap-4">
            {CHAPTERS.map((c, i) => (
              <article
                key={c.id}
                id={`showcase-${c.id}`}
                aria-labelledby={`showcase-${c.id}-title`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                tabIndex={0}
                className={`scroll-mt-28 rounded-3xl border p-6 transition-colors duration-200 sm:p-8 ${
                  i === active
                    ? "border-[#0b1220] bg-[#0b1220] text-white"
                    : "border-[#0b1220]/10 bg-[#f7f9fc] text-[#0b1220]"
                }`}
              >
                {/* Media above the card body on mobile */}
                <figure className="mb-6 overflow-hidden rounded-2xl lg:hidden">
                  <img
                    src={c.image}
                    width={c.width}
                    height={c.height}
                    alt={c.alt}
                    loading="lazy"
                    className="aspect-[4/3] h-auto w-full object-cover"
                  />
                  <figcaption
                    className={`px-1 pt-3 text-[14px] leading-relaxed ${
                      i === active ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    {c.caption}
                  </figcaption>
                </figure>
                <p
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] ${
                    i === active ? "bg-white/10 text-[#67e8f9]" : "bg-[#0b6e8f]/10 text-[#0b6e8f]"
                  }`}
                >
                  <c.icon className="h-4 w-4" aria-hidden="true" />
                  {c.kicker}
                </p>
                <h3
                  id={`showcase-${c.id}-title`}
                  className={`mt-4 font-display text-3xl font-bold tracking-tight ${
                    i === active ? "text-white" : "text-[#0b1220]"
                  }`}
                >
                  {c.title}
                </h3>
                <p className={`mt-4 text-[16px] leading-[1.6] ${i === active ? "text-white/80" : "text-[#475569]"}`}>
                  {c.body}
                </p>
                <ul className="mt-4 grid gap-3">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[16px] font-medium leading-[1.5]">
                      <CheckCircle2
                        aria-hidden="true"
                        className={`mt-1 h-5 w-5 shrink-0 ${i === active ? "text-[#67e8f9]" : "text-[#0b6e8f]"}`}
                      />
                      <span className={i === active ? "text-white/90" : "text-[#334155]"}>{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}

            <a
              href="mailto:geemalmuthugala@gmail.com?subject=Hardware%20spec%20sheet%20request"
              className="group flex min-h-[88px] items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#0b6e8f] to-[#0e3b52] p-6 text-white no-underline sm:p-8"
            >
              <span>
                <span className="block text-xs font-bold uppercase tracking-[0.08em] text-white/70">
                  Hardware spec sheet
                </span>
                <span className="mt-1 block font-display text-2xl font-bold">
                  Download the hardware spec sheet
                </span>
                <span className="mt-1 block text-[14px] text-white/70">
                  Dimensions, ratings, power and connectivity for both units.
                </span>
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#0b1220] transition-transform duration-200 group-hover:rotate-45">
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProductShowcase;
