import React from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { library } from '../lib/library';
import { arrivals } from '../lib/data.js';

const ARROW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4.5 12h14.5M12.5 6l6.5 6-6.5 6"/></svg>';

const EYEBROW = 'font-family:var(--mono);font-size:11.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:14px';
const HEADING = 'font-family:var(--serif);font-weight:700;font-size:clamp(32px,5vw,56px);line-height:1;letter-spacing:-0.02em;margin:0';
const SEE_ALL = 'display:inline-flex;align-items:center;gap:7px;color:var(--ink-soft);text-decoration:none;font-weight:700;border-bottom:2px solid var(--accent);padding-bottom:3px';
const STAR = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="display:block"><path d="M12 3.5l2.6 5.45 5.9.78-4.35 4.05 1.12 5.87L12 16.9l-5.27 2.75 1.12-5.87L3.5 9.73l5.9-.78z"/></svg>';

/* New Arrivals, rendered from data.js. Books are described like coffee
   (roast chip + tasting notes). data-tilt / data-action="wish" / "cart"
   hooks are preserved so the runtime wires tilt and the cart/wishlist badges. */
export default function Arrivals() {
  return (
    <section id="arrivals" style={css('position:relative;z-index:2;padding:90px 28px;background:var(--bg-1)')}>
      <div style={css('max-width:1240px;margin:0 auto')}>
        <div style={css('display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:18px;margin-bottom:42px')}>
          <div>
            <div data-reveal style={css(EYEBROW)}>Just arrived</div>
            <h2 data-reveal data-reveal-delay="80" style={css(HEADING)}>Fresh off the cart.</h2>
          </div>
          <a href="#library" data-reveal data-reveal-delay="160" style={css(SEE_ALL)}>
            View all books <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={ARROW} />
          </a>
        </div>
        <div data-stagger-group data-arrivals-grid style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:22px')}>
          {arrivals.map((b, i) => (
            <div key={i} data-reveal style={css('display:flex;flex-direction:column;gap:13px')}>
              <div
                data-tilt role="link" tabIndex={0}
                aria-label={'View details for ' + b.title}
                onClick={(e) => { if (e.target.closest('[data-action]')) return; const m = library.getBooks().find((x) => x.title === b.title); window.location.hash = '#book/' + encodeURIComponent((m && m.id) || b.title); }}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-action]')) { e.preventDefault(); const m = library.getBooks().find((x) => x.title === b.title); window.location.hash = '#book/' + encodeURIComponent((m && m.id) || b.title); } }}
                style={css('position:relative;cursor:pointer')}
              >
                <div style={css('aspect-ratio:2/3;border-radius:12px;background:' + b.tint + ';box-shadow:0 20px 44px rgba(0,0,0,.4);display:flex;align-items:flex-end;padding:20px;position:relative;overflow:hidden;transition:transform .3s')}>
                  <div style={css('position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.12),transparent 42%,rgba(0,0,0,.4))')} />
                  <div style={css('position:absolute;top:0;bottom:0;left:9px;width:2px;background:rgba(255,255,255,.18)')} />
                  {b.lang ? (
                    <div style={css('position:absolute;top:12px;right:12px;z-index:3;padding:4px 9px;border-radius:99px;background:rgba(0,0,0,.45);color:#fff;font-size:11px;font-weight:700;letter-spacing:.04em')}>{b.lang}</div>
                  ) : null}
                  <div style={css('position:relative;z-index:2')}>
                    <div style={css('font-family:var(--serif);font-size:20px;font-weight:700;color:#fff;line-height:1.12')}>{b.title}</div>
                    <div style={css('font-size:12.5px;color:rgba(255,255,255,.8);margin-top:5px')}>{b.author}</div>
                  </div>
                  <Svg as="button" data-action="wish" data-title={b.title} aria-pressed="false" aria-label={'Save ' + b.title + ' to wishlist'} style={{ ...css('position:absolute;top:11px;left:11px;z-index:3;width:34px;height:34px;border-radius:50%;border:none;background:rgba(0,0,0,.4);color:#fff;cursor:pointer;transition:.2s'), display: 'grid', placeItems: 'center' }} html={icon('heart', 16, 1.7)} />
                </div>
              </div>
              <div style={css('display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10.5px;color:var(--ink-mute);letter-spacing:.02em;min-width:0')}>
                <span style={css('color:var(--accent-2);border:1px solid var(--line);padding:2px 7px;border-radius:99px;text-transform:uppercase;white-space:nowrap;flex-shrink:0')}>{b.roast}</span>
                <span style={css('overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1')}>{b.notes}</span>
              </div>
              <div style={css('display:flex;justify-content:space-between;align-items:flex-end;gap:8px;flex-wrap:wrap')}>
                <div>
                  <div style={css('display:flex;align-items:center;gap:4px;font-family:var(--mono);font-size:11.5px;color:var(--accent-2);font-weight:500')}>
                    <Svg as="span" html={STAR} /> {b.rating}
                  </div>
                  <div style={css('font-family:var(--serif);font-size:18px;font-weight:700;margin-top:3px;font-optical-sizing:auto')}>{b.price}</div>
                </div>
                <button data-action="add-cart" data-title={b.title} data-price={b.price} aria-label={'Add ' + b.title + ' to bag'} style={css('padding:10px 16px;border-radius:99px;background:var(--ink);color:var(--bg);border:none;font-weight:700;font-size:13.5px;cursor:pointer;transition:.2s;white-space:nowrap')}>Add to cart</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
