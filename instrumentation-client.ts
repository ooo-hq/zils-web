import { init } from '@plausible-analytics/tracker';

// Initialize once before hydration. Plausible tracks subsequent router visits.
if (
  process.env.NODE_ENV === 'production' &&
  ['zils.ai', 'www.zils.ai'].includes(window.location.hostname)
) {
  init({
    domain: 'zils.ai',
    logging: false,
    transformRequest(payload) {
      try {
        const url = new URL(payload.u);
        // Keep internal tools and individual shared artifacts out of analytics.
        if (/^\/(?:admin|pricing-lab|a)(?:\/|$)/.test(url.pathname)) return null;

        return {
          ...payload,
          // Exclude sign-in codes, URL parameters, and fragments from analytics.
          u: `${url.origin}${url.pathname}`,
          r: payload.r ? new URL(payload.r).origin : null,
        };
      } catch {
        return null;
      }
    },
  });
}
