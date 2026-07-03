/* Site settings store: editable chrome (brand, banner, contact, theme accent)
   managed from the admin dashboard and applied to the live page. Text is bound
   to elements marked with data-setting / data-setting-href in the partials; the
   accent is applied as a CSS variable on #app so it wins in both themes. */
import { api } from './api.js';

let settings = {};
const listeners = new Set();
const emit = () => listeners.forEach((l) => l(settings));

function root() {
  return (typeof document !== 'undefined' && document.getElementById('app')) || (typeof document !== 'undefined' ? document.documentElement : null);
}

function fillText(key, val) {
  if (val == null || typeof document === 'undefined') return;
  document.querySelectorAll(`[data-setting="${key}"]`).forEach((el) => { el.textContent = val; });
}
function fillHref(key, val) {
  if (val == null || typeof document === 'undefined') return;
  document.querySelectorAll(`[data-setting-href="${key}"]`).forEach((el) => { el.setAttribute('href', val); });
}

function apply() {
  if (typeof document === 'undefined') return;
  const r = root();
  if (r) {
    if (settings.accent) r.style.setProperty('--accent', settings.accent);
    else r.style.removeProperty('--accent');
  }
  fillText('brandName', settings.brandName);
  fillText('bannerText', settings.bannerText);
  fillText('bannerCta', settings.bannerCtaText);
  fillHref('bannerLink', settings.bannerLink);
  fillText('contactEmail', settings.contactEmail);
  fillHref('contactEmail', settings.contactEmail == null ? null : 'mailto:' + settings.contactEmail);
  fillHref('instagramUrl', settings.instagramUrl);
  document.querySelectorAll('[data-setting-banner]').forEach((el) => {
    el.style.display = settings.bannerEnabled === 'false' ? 'none' : '';
  });
}

export const site = {
  get: () => settings,
  /* Seed from the bootstrap payload and paint the page. */
  hydrate(next) {
    settings = next || {};
    apply();
    emit();
  },
  /* Re-apply (e.g. after the partials (re)render). */
  refresh: apply,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /* Admin write. */
  async save(patch) {
    const r = await api.put('/settings', patch);
    settings = (r && r.settings) || settings;
    apply();
    emit();
    return settings;
  },
};
