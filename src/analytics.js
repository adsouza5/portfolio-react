const GA_ID = 'G-4D30QRHEXB';

function gtag(...args) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag(...args);
}

export function initAnalytics() {
  gtag('config', GA_ID, { send_page_view: false });
}

export function trackPage(path, title) {
  gtag('event', 'page_view', {
    page_path:  path + (window.location?.search || ''),
    page_title: title,
    send_to:    GA_ID,
  });
}

export function trackEvent(eventName, params = {}) {
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
