import { Link } from "react-router-dom";

/**
 * Terms skeleton. TODO(owner): have legal review before launch.
 */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0b6e8f]">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#0b1220]">
          Terms of use
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: September 2026.
        </p>
        <div className="prose mt-8 grid gap-6 text-[16px] leading-[1.6] text-slate-700">
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">This website</h2>
            <p className="mt-2">
              Content on this marketing site is provided for general information about
              CargoMonitor products and does not constitute a service offer. Service levels,
              pricing and contract terms are agreed in a signed order form or service
              agreement.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">Demonstrations and pilots</h2>
            <p className="mt-2">
              Demo and pilot scope, hardware responsibilities, connectivity requirements and
              support hours are agreed in writing before equipment ships.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">Intellectual property</h2>
            <p className="mt-2">
              Site content, console software and firmware remain the property of their
              respective owners. Customer telemetry data remains the customer&apos;s property
              under the service agreement.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">Contact</h2>
            <p className="mt-2">
              Questions about these terms:{" "}
              <a className="font-semibold text-[#0b6e8f]" href="mailto:geemalmuthugala@gmail.com?subject=Terms%20question">
                geemalmuthugala@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
        <Link to="/" className="mt-10 inline-block font-semibold text-[#0b6e8f]">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
