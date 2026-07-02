import React from 'react';

/* Hand-drawn line-icon set (currentColor). icon() returns an SVG string;
   render it through <Svg html={...} /> so the markup stays verbatim. */
function svgStr(inner, s, sw, fill) {
  s = s || 24; sw = sw || 1.6;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="${fill || 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="display:block;overflow:visible">${inner}</svg>`;
}

const PATHS = {
  cup:    '<path d="M4.8 9h9.4v4.6a4.7 4.7 0 0 1-4.7 4.7A4.7 4.7 0 0 1 4.8 13.6z"/><path d="M14.2 9.9h1.7a2.05 2.05 0 0 1 0 4.1h-1.7"/><path d="M3.4 20.6h12.2"/><path d="M7.6 3.2c-.8 1 .8 2 0 3M11 3.2c-.8 1 .8 2 0 3" opacity=".75"/>',
  heart:  '<path d="M12 19.6l-1.25-1.13C6.4 14.5 3.6 12 3.6 8.95 3.6 6.5 5.55 4.6 8 4.6c1.38 0 2.7.64 3.57 1.66l.43.5.43-.5A4.7 4.7 0 0 1 16 4.6c2.45 0 4.4 1.9 4.4 4.35 0 3.05-2.8 5.55-7.15 9.52z"/>',
  search: '<circle cx="11" cy="11" r="6.1"/><path d="M19.8 19.8l-4.35-4.35"/>',
  sun:    '<circle cx="12" cy="12" r="3.9"/><path d="M12 2.6v2.3M12 19.1v2.3M21.4 12h-2.3M5 12H2.6M18.65 5.35l-1.6 1.6M6.95 17.05l-1.6 1.6M18.65 18.65l-1.6-1.6M6.95 6.95l-1.6-1.6"/>',
  moon:   '<path d="M20.2 14.4A8.2 8.2 0 1 1 9.6 3.8a6.4 6.4 0 0 0 10.6 10.6z"/>',
  bag:    '<path d="M6.4 8.4h11.2l.85 11.2a1.5 1.5 0 0 1-1.5 1.6H7.05a1.5 1.5 0 0 1-1.5-1.6z"/><path d="M9 8.4V7a3 3 0 0 1 6 0v1.4"/>',
  menu:   '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close:  '<path d="M6 6l12 12M18 6L6 18"/>',
  gift:   '<rect x="4" y="9.2" width="16" height="11" rx="1.3"/><path d="M4 13.2h16M12 9.2v11"/><path d="M12 9.2S10.6 4.9 8.1 5.6C6.2 6.1 6.85 9.2 9.1 9.2zM12 9.2s1.4-4.3 3.9-3.6c1.9.5 1.25 3.6-1 3.6z"/>',
  mail:   '<rect x="3.4" y="5.8" width="17.2" height="12.4" rx="1.6"/><path d="M3.9 6.7l7.1 5.1a1.7 1.7 0 0 0 2 0l7.1-5.1"/>',
  arrowR: '<path d="M4.5 12h14.5M12.5 6l6.5 6-6.5 6"/>',
  arrowU: '<path d="M12 19.5V5M6 11l6-6 6 6"/>',
  book:   '<path d="M12 6.4C10.5 5.2 8.5 4.9 6.6 4.9H3.6v12.4H7c1.9 0 3.6.4 5 1.5 1.4-1.1 3.1-1.5 5-1.5h3.4V4.9H18c-1.9 0-3.9.3-5.4 1.5z"/><path d="M12 6.4v12.4"/>',
  rose:   '<path d="M12 6.5a2.6 2.6 0 0 1 0 5.2 2.6 2.6 0 0 1 0-5.2z"/><circle cx="12" cy="9.1" r="3.4"/><path d="M12 12.5v7.2M12 16.4c-1.9 0-3.3-1.05-3.9-2.7M12 16.4c1.9 0 3.3-1.05 3.9-2.7"/>',
  sparkle:'<path d="M12 3.4l1.55 4.95a3 3 0 0 0 1.95 1.95L20.6 12l-5.15 1.55a3 3 0 0 0-1.95 1.95L12 20.6l-1.55-5.15a3 3 0 0 0-1.95-1.95L3.4 12l5.15-1.55a3 3 0 0 0 1.95-1.95z"/><path d="M19 4v3M20.5 5.5h-3" opacity=".7"/>',
  compass:'<circle cx="12" cy="12" r="8.4"/><path d="M15.4 8.6l-1.95 4.35-4.35 1.95 1.95-4.35z"/>',
  balloon:'<path d="M12 14.4c2.95 0 4.9-2.45 4.9-5.55S14.95 3.4 12 3.4 7.1 5.75 7.1 8.85 9.05 14.4 12 14.4z"/><path d="M12 14.4l-.05 2.3M11.95 16.7l-1.15 1.3M11.95 16.7l1.15 1.3"/>',
  bolt:   '<path d="M13.2 3.4 5.6 13.1H11l-1 7.5 7.9-10.2H12z"/>',
  mist:   '<path d="M3.8 8.3c2-1.5 4.2-1.5 6.2 0s4.2 1.5 6.2 0M4.8 12.7c2-1.5 4.2-1.5 6.2 0s4.2 1.5 6.2 0M3.8 17.1c2-1.5 4.2-1.5 6.2 0s4.2 1.5 6.2 0"/>',
  flame:  '<path d="M12 20.8c3.2 0 5.4-2.15 5.4-5.1 0-3.45-2.95-4.95-2.35-8.7-2.6 1-3.75 2.95-3.75 4.95 0 .9-.6 1.4-1.2 1.4-.85 0-1.35-.78-1.25-1.85C7.95 7.6 8.4 4 8.4 4 6.95 5.95 5.5 8.4 5.5 12.15c0 5.1 4.1 8.65 6.5 8.65z"/>',
  pin:    '<path d="M12 20.8s6.4-5.05 6.4-10.05A6.4 6.4 0 0 0 5.6 10.75C5.6 15.75 12 20.8 12 20.8z"/><circle cx="12" cy="10.4" r="2.25"/>',
  clock:  '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6v4.6l2.9 1.75"/>',
  bean:   '<ellipse cx="12" cy="12" rx="4.6" ry="7.2" transform="rotate(26 12 12)"/><path d="M9.7 6.7c2.3 1.9 1.85 7.6-1.1 10.6"/>',
  check:  '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
  lock:   '<rect x="5" y="10.4" width="14" height="9.6" rx="1.7"/><path d="M8.1 10.4V8a3.9 3.9 0 0 1 7.8 0v2.4"/><path d="M12 14.1v2.6"/>',
  plus:   '<path d="M12 5v14M5 12h14"/>',
  minus:  '<path d="M5 12h14"/>',
};

export function icon(name, s, sw, fill) {
  return svgStr(PATHS[name] || '', s, sw, fill);
}

/* Renders an SVG (or any trusted HTML) string inline. */
export function Svg({ html, as = 'span', style, ...rest }) {
  const Tag = as;
  return <Tag style={{ display: 'grid', placeItems: 'center', ...style }} dangerouslySetInnerHTML={{ __html: html }} {...rest} />;
}
