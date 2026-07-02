import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { library } from '../lib/library';
import { store } from '../lib/store';
import AdminPanel from './AdminPanel.jsx';

const STAR = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="display:block"><path d="M12 3.5l2.6 5.45 5.9.78-4.35 4.05 1.12 5.87L12 16.9l-5.27 2.75 1.12-5.87L3.5 9.73l5.9-.78z"/></svg>';

function BookCard({ b }) {
  return (
    <div data-book style={css('display:flex;flex-direction:column;gap:13px')}>
      <div
        data-tilt role="link" tabIndex={0}
        aria-label={'View details for ' + b.title}
        onClick={(e) => { if (e.target.closest('[data-action]')) return; window.location.hash = '#book/' + encodeURIComponent(b.id || b.title); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-action]')) { e.preventDefault(); window.location.hash = '#book/' + encodeURIComponent(b.id || b.title); } }}
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
          <Svg as="button" data-action="wish" data-title={b.title} aria-pressed={store.inWishlist(b.title) ? 'true' : 'false'} aria-label={'Save ' + b.title + ' to wishlist'} style={{ ...css('position:absolute;top:11px;left:11px;z-index:3;width:34px;height:34px;border-radius:50%;border:none;background:rgba(0,0,0,.4);color:#fff;cursor:pointer;transition:.2s'), display: 'grid', placeItems: 'center' }} html={icon('heart', 16, 1.7)} />
        </div>
      </div>
      <div style={css('display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10.5px;color:var(--ink-mute);letter-spacing:.02em;min-width:0')}>
        <span style={css('color:var(--accent-2);border:1px solid var(--line);padding:2px 7px;border-radius:99px;text-transform:uppercase;white-space:nowrap;flex-shrink:0')}>{b.roast}</span>
        {b.genre ? <span style={css('color:var(--ink-mute);border:1px solid var(--line);padding:2px 7px;border-radius:99px;white-space:nowrap;flex-shrink:0')}>{b.genre}</span> : null}
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
  );
}

export default function Library({ open, genre, adminOpen, onClose }) {
  const [activeGenre, setActiveGenre] = useState(genre || 'All');
  const [query, setQuery] = useState('');
  const [admin, setAdmin] = useState(Boolean(adminOpen));
  const [, force] = useState(0);

  useEffect(() => library.subscribe(() => force((n) => n + 1)), []);
  useEffect(() => { if (open) setActiveGenre(genre || 'All'); }, [genre, open]);
  useEffect(() => { if (open) setAdmin(Boolean(adminOpen)); }, [adminOpen, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (admin) setAdmin(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, admin, onClose]);

  if (!open) return null;

  const books = library.getBooks();
  const genres = library.genres();
  const effective = activeGenre === 'All' || genres.includes(activeGenre) ? activeGenre : 'All';
  const q = query.trim().toLowerCase();
  const filtered = books.filter((b) => {
    if (effective !== 'All' && b.genre !== effective) return false;
    if (q) {
      const hay = (b.title + ' ' + b.author + ' ' + (b.notes || '') + ' ' + (b.genre || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const chips = ['All', ...genres];

  const chipStyle = (on) =>
    css('padding:8px 15px;border-radius:99px;border:1px solid ' + (on ? 'var(--accent)' : 'var(--line)') + ';background:' + (on ? 'var(--accent)' : 'transparent') + ';color:' + (on ? 'var(--accent-ink)' : 'var(--ink-soft)') + ';font:600 13px/1 var(--sans);cursor:pointer;white-space:nowrap;transition:.2s');

  return (
    <div style={css('position:fixed;inset:0;z-index:8000;background:var(--bg);color:var(--ink);overflow:auto;animation:libIn .32s var(--ease)')}>
      <header style={css('position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line-soft)')}>
        <div style={css('max-width:1240px;margin:0 auto;padding:18px 28px 0')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap')}>
            <div style={css('display:flex;align-items:baseline;gap:12px')}>
              <div style={css('font-family:var(--serif);font-size:clamp(24px,4vw,34px);font-weight:700;letter-spacing:-.02em')}>The Library</div>
              <div style={css('font-family:var(--mono);font-size:12px;color:var(--ink-mute);letter-spacing:.04em')}>{filtered.length} {filtered.length === 1 ? 'title' : 'titles'}</div>
            </div>
            <div style={css('display:flex;align-items:center;gap:10px')}>
              <button type="button" onClick={() => setAdmin(true)} style={css('display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:99px;border:1px solid var(--line);background:transparent;color:var(--ink-soft);font:600 13px/1 var(--sans);cursor:pointer;transition:.2s')}>
                <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={icon('lock', 15, 1.8)} /> Admin
              </button>
              <button type="button" aria-label="Close library" onClick={onClose} style={css('display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer;transition:.2s')}>
                <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 18, 2)} />
              </button>
            </div>
          </div>

          <div style={css('display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 0 15px')}>
            <div style={css('display:flex;gap:9px;overflow-x:auto;padding-bottom:2px;flex:1;min-width:0')}>
              {chips.map((g) => (
                <button key={g} type="button" onClick={() => setActiveGenre(g)} style={chipStyle(effective === g)}>{g}</button>
              ))}
            </div>
            <div style={css('position:relative;flex-shrink:0')}>
              <span style={css('position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ink-mute);display:grid')}>
                <Svg as="span" style={{ display: 'inline-grid' }} html={icon('search', 15, 1.8)} />
              </span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the shelf" aria-label="Search the shelf"
                style={css('width:min(230px,52vw);background:var(--bg-1);border:1px solid var(--line);border-radius:99px;padding:9px 14px 9px 34px;color:var(--ink);font:500 13.5px/1 var(--sans);outline:none')} />
            </div>
          </div>
        </div>
      </header>

      <div style={css('max-width:1240px;margin:0 auto;padding:28px')}>
        {filtered.length ? (
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(218px,1fr));gap:24px')}>
            {filtered.map((b, i) => <BookCard key={b.title + i} b={b} />)}
          </div>
        ) : (
          <div style={css('text-align:center;padding:90px 20px;color:var(--ink-mute)')}>
            <div style={css('font-family:var(--serif);font-size:24px;color:var(--ink-soft);margin-bottom:8px')}>Nothing on this shelf yet.</div>
            <div style={css('font-size:14px;margin-bottom:20px')}>Try another corner, or clear your filters.</div>
            <button type="button" onClick={() => { setActiveGenre('All'); setQuery(''); }} style={css('padding:11px 20px;border-radius:99px;background:var(--accent);color:var(--accent-ink);border:none;font-weight:700;font-size:13.5px;cursor:pointer')}>Show all books</button>
          </div>
        )}
      </div>

      <AdminPanel open={admin} onClose={() => setAdmin(false)} />
    </div>
  );
}
