import { useEffect, useState } from "react";
import { CONSENT_KEY } from "@/lib/analytics";

/**
 * Minimal cookie-consent banner. CTA analytics fire only after "Accept".
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* storage unavailable — banner simply stays dismissed for the session */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-[14px] leading-relaxed text-white/75">
          We use privacy-friendly analytics to measure demo requests. No advertising
          trackers. See our <a href="/privacy" className="font-semibold text-white underline">privacy notice</a>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="min-h-[44px] rounded-full border border-white/20 px-5 text-sm font-semibold text-white"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="min-h-[44px] rounded-full bg-white px-5 text-sm font-bold text-[#0b1220]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsentBanner;
