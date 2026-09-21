/**
 * Minimal analytics dispatcher. Events fire only after the visitor grants
 * consent in the cookie banner (localStorage "cm-consent" === "granted").
 * TODO(owner): wire `send` to your analytics provider (e.g. PostHog/Plausible).
 */
const CONSENT_KEY = "cm-consent";

export function hasConsent() {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function trackEvent(name, props = {}) {
  if (!hasConsent()) return;
  // TODO(owner): replace with provider SDK call.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${name}`, props);
  }
}

export { CONSENT_KEY };
