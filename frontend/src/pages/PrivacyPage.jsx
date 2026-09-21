import { Link } from "react-router-dom";

/**
 * Privacy notice skeleton with truthful statements about the demo form.
 * TODO(owner): have legal review and complete company details before launch.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0b6e8f]">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#0b1220]">
          Privacy notice
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: September 2026.
        </p>
        <div className="prose mt-8 grid gap-6 text-[16px] leading-[1.6] text-slate-700">
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">What we collect</h2>
            <p className="mt-2">
              When you request a demo we collect your name, work email, company, fleet size,
              cargo type and any message you include. The marketing site stores a cookie-consent
              choice on your device. Analytics events fire only after you accept.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">How we use it</h2>
            <p className="mt-2">
              We use demo-request details solely to respond to your enquiry and to prepare a
              relevant demonstration. We do not sell personal data and we do not run
              advertising trackers on this site.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">Tenant telemetry data</h2>
            <p className="mt-2">
              Telemetry collected by customer hardware is processed under each customer&apos;s
              service agreement, with tenant-isolated storage. That agreement lists retention
              periods and subprocessors.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold text-[#0b1220]">Your rights and contact</h2>
            <p className="mt-2">
              To access, correct or delete your details, email{" "}
              <a className="font-semibold text-[#0b6e8f]" href="mailto:geemalmuthugala@gmail.com?subject=Privacy%20request">
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
