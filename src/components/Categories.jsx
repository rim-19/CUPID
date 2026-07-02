import React from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { categories } from '../lib/data.js';

const EYEBROW = 'font-family:var(--mono);font-size:11.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:14px';
const HEADING = 'font-family:var(--serif);font-weight:700;font-size:clamp(32px,5vw,56px);line-height:1;letter-spacing:-0.02em;margin:0';
const SEE_ALL = 'display:inline-flex;align-items:center;gap:7px;color:var(--ink-soft);text-decoration:none;font-weight:700;border-bottom:2px solid var(--accent);padding-bottom:3px';
const CARD = 'text-decoration:none;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:26px 22px;display:flex;flex-direction:column;gap:16px;min-height:152px;justify-content:space-between;cursor:pointer';

/* Real React rendering of the shelves grid from data.js.
   Keeps the original data-* hooks (data-reveal, data-stagger-group,
   data-cat-grid) and classes (lift, cat-card, cat-ic) so the shared CSS and
   the runtime's reveal/scroll effects apply exactly as before. */
export default function Categories() {
  return (
    <section id="categories" style={css('position:relative;z-index:2;padding:96px 28px;background:var(--bg-1)')}>
      <div style={css('max-width:1180px;margin:0 auto')}>
        <div style={css('display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:18px;margin-bottom:42px')}>
          <div>
            <div data-reveal style={css(EYEBROW)}>The shelves</div>
            <h2 data-reveal data-reveal-delay="80" style={css(HEADING)}>Find your corner.</h2>
          </div>
          <a href="#library" data-reveal data-reveal-delay="160" style={css(SEE_ALL)}>
            All books <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={icon('arrowR', 15, 1.9)} />
          </a>
        </div>
        <div data-stagger-group data-cat-grid style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:16px')}>
          {categories.map((c) => (
            <a key={c.name} href={'#library/' + encodeURIComponent(c.name)} data-reveal="scale" className="lift cat-card" style={css(CARD)}>
              <Svg as="span" className="cat-ic" style={{ width: '52px', height: '52px', borderRadius: '14px', background: c.tint, color: 'var(--accent)', transition: 'transform .35s var(--ease),color .3s' }} html={icon(c.ic, 25, 1.55)} />
              <div>
                <div style={css('font-family:var(--serif);font-size:22px;font-weight:600;font-optical-sizing:auto')}>{c.name}</div>
                <div style={css('font-family:var(--mono);font-size:12px;color:var(--ink-mute);font-weight:500;margin-top:5px;letter-spacing:.04em')}>{c.count} titles</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
