import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Enterprise demo request form.
 * TODO(owner): set FORM_ENDPOINT to the real handler (API route or form service).
 */
const FORM_ENDPOINT = ""; // e.g. "/api/demo-requests"

const FLEET_SIZES = ["1–10 trucks", "11–50 trucks", "51–200 trucks", "200+ trucks"];
const CARGO_TYPES = ["Cold chain", "Pharmaceuticals", "High-value cargo", "Perishables", "Port and yard", "Other"];

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[14px] font-medium text-[#b42318]">
      {message}
    </p>
  );
}

export function DemoForm() {
  const [values, setValues] = useState({
    name: "",
    email: "",
    company: "",
    fleetSize: "",
    cargoType: "",
    message: "",
    companyWebsite: "", // honeypot — must stay empty
    consent: false,
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent | failed

  const set = (key) => (e) => {
    const next = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: next }));
    if (key === "name" || key === "email" || key === "company") trackEvent("demo_form_start", { field: key });
  };

  const validate = () => {
    const next = {};
    if (values.name.trim().length < 2) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim()))
      next.email = "Enter a valid work email, e.g. name@company.com.";
    if (values.company.trim().length < 2) next.company = "Enter your company name.";
    if (!values.fleetSize) next.fleetSize = "Select your fleet size.";
    if (!values.cargoType) next.cargoType = "Select your cargo type.";
    if (!values.consent) next.consent = "Please accept the privacy notice so we can reply.";
    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      document.getElementById("demo-name")?.focus();
      return;
    }
    // Honeypot: silently accept spam without sending.
    if (values.companyWebsite) {
      setStatus("sent");
      return;
    }
    setStatus("sending");
    trackEvent("demo_form_submit", { fleetSize: values.fleetSize, cargoType: values.cargoType });
    try {
      if (FORM_ENDPOINT) {
        const res = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, companyWebsite: undefined }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // TODO(owner): remove simulated delay once FORM_ENDPOINT is set.
        await new Promise((r) => setTimeout(r, 900));
      }
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-8 text-center">
        <p className="font-display text-2xl font-bold text-white">Request received.</p>
        <p className="mx-auto mt-2 max-w-md text-[16px] leading-relaxed text-white/70">
          Thank you{values.name ? `, ${values.name.split(" ")[0]}` : ""}. We reply within one
          business day. For anything urgent, call{" "}
          <a href="tel:+94711625588" className="font-semibold text-white underline">
            071 162 5588
          </a>
          .
        </p>
      </div>
    );
  }

  const inputCls =
    "mt-1.5 w-full min-h-[48px] rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-[16px] text-white placeholder:text-white/40";

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Request an enterprise demo" className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="demo-name" className="text-[14px] font-semibold text-white/85">
            Full name
          </label>
          <input
            id="demo-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Amaya Perera"
            value={values.name}
            onChange={set("name")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "demo-name-error" : undefined}
            className={inputCls}
          />
          <FieldError id="demo-name-error" message={errors.name} />
        </div>
        <div>
          <label htmlFor="demo-email" className="text-[14px] font-semibold text-white/85">
            Work email
          </label>
          <input
            id="demo-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={set("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "demo-email-error" : undefined}
            className={inputCls}
          />
          <FieldError id="demo-email-error" message={errors.email} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="demo-company" className="text-[14px] font-semibold text-white/85">
            Company
          </label>
          <input
            id="demo-company"
            name="company"
            type="text"
            autoComplete="organization"
            placeholder="Company (Pvt) Ltd"
            value={values.company}
            onChange={set("company")}
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "demo-company-error" : undefined}
            className={inputCls}
          />
          <FieldError id="demo-company-error" message={errors.company} />
        </div>
        <div>
          <label htmlFor="demo-fleet" className="text-[14px] font-semibold text-white/85">
            Fleet size
          </label>
          <select
            id="demo-fleet"
            name="fleetSize"
            value={values.fleetSize}
            onChange={set("fleetSize")}
            aria-invalid={Boolean(errors.fleetSize)}
            aria-describedby={errors.fleetSize ? "demo-fleet-error" : undefined}
            className={`${inputCls} [&>option]:text-black`}
          >
            <option value="">Select…</option>
            {FLEET_SIZES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <FieldError id="demo-fleet-error" message={errors.fleetSize} />
        </div>
      </div>

      <div>
        <label htmlFor="demo-cargo" className="text-[14px] font-semibold text-white/85">
          Cargo type
        </label>
        <select
          id="demo-cargo"
          name="cargoType"
          value={values.cargoType}
          onChange={set("cargoType")}
          aria-invalid={Boolean(errors.cargoType)}
          aria-describedby={errors.cargoType ? "demo-cargo-error" : undefined}
          className={`${inputCls} [&>option]:text-black`}
        >
          <option value="">Select…</option>
          {CARGO_TYPES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <FieldError id="demo-cargo-error" message={errors.cargoType} />
      </div>

      <div>
        <label htmlFor="demo-message" className="text-[14px] font-semibold text-white/85">
          Message <span className="font-normal text-white/55">(optional)</span>
        </label>
        <textarea
          id="demo-message"
          name="message"
          rows={4}
          placeholder="Lanes, cargo profile and timeline…"
          value={values.message}
          onChange={set("message")}
          className={`${inputCls} min-h-[112px] resize-y`}
        />
      </div>

      {/* Honeypot spam trap — hidden from sighted and screen-reader users */}
      <div className="hidden" aria-hidden="true">
        <label>
          Company website
          <input
            type="text"
            name="companyWebsite"
            tabIndex={-1}
            autoComplete="off"
            value={values.companyWebsite}
            onChange={set("companyWebsite")}
          />
        </label>
      </div>

      <div>
        <label htmlFor="demo-consent" className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-white/70">
          <input
            id="demo-consent"
            name="consent"
            type="checkbox"
            checked={values.consent}
            onChange={set("consent")}
            aria-describedby={errors.consent ? "demo-consent-error" : undefined}
            className="mt-1 h-5 w-5 shrink-0 accent-[#22d3ee]"
          />
          <span>
            I agree to be contacted about a demo. Details are handled under our{" "}
            <a href="/privacy" className="font-semibold text-white underline">
              privacy notice
            </a>
            .
          </span>
        </label>
        <FieldError id="demo-consent-error" message={errors.consent} />
      </div>

      {status === "failed" ? (
        <p role="alert" className="rounded-xl border border-red-300/30 bg-red-400/10 p-4 text-[14px] text-red-200">
          Something went wrong sending your request. Please try again, or email us directly at{" "}
          <a href="mailto:geemalmuthugala@gmail.com?subject=Enterprise%20demo%20request" className="font-semibold underline">
            geemalmuthugala@gmail.com
          </a>
          .
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-white px-8 text-base font-bold text-[#0b1220] transition-transform duration-200 hover:scale-[1.01] disabled:cursor-wait disabled:opacity-70"
      >
        {status === "sending" ? "Sending…" : "Request an enterprise demo"}
      </button>
      <p className="text-center text-[14px] text-white/55">We reply within one business day.</p>
    </form>
  );
}

export default DemoForm;
