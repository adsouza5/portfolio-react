const GA_ID       = 'G-4D30QRHEXB';
const INTERNAL_KEY = 'an_internal';

function gtag(...args) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag(...args);
}

export function isInternalTraffic() {
  return localStorage.getItem(INTERNAL_KEY) === '1';
}

export function markAsInternal() {
  localStorage.setItem(INTERNAL_KEY, '1');
  // Tell GA4 this session is internal so the Data Filter catches it
  gtag('config', GA_ID, { traffic_type: 'internal' });
}

export function trackPage(path, title) {
  if (isInternalTraffic()) return;
  gtag('event', 'page_view', {
    page_path:  path + (window.location?.search || ''),
    page_title: title,
    send_to:    GA_ID,
  });
}

export function trackEvent(eventName, params = {}) {
  if (isInternalTraffic()) return;
  gtag('event', eventName, { send_to: GA_ID, ...params });
}

// Convenience wrappers used across the app
export const track = {
  projectClick:      (project)  => trackEvent('project_click',       { project }),
  showcaseView:      (showcase) => trackEvent('showcase_view',        { showcase }),
  showcaseFeature:   (showcase, feature) => trackEvent('showcase_feature', { showcase, feature }),
  beyondCodeOpen:    ()         => trackEvent('beyond_code_open'),
  voiceUsed:         ()         => trackEvent('voice_used'),
  currencyConverted: (from, to) => trackEvent('currency_converted',   { from, to }),
  lensSearch:        ()         => trackEvent('lens_search'),
  lensIndex:         ()         => trackEvent('lens_index'),
  prismRequest:      (type)     => trackEvent('prism_request',        { type }),
  sentinelPredict:   ()         => trackEvent('sentinel_predict'),
};
