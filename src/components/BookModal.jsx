import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { library } from '../lib/library';
import { store } from '../lib/store';
import { api } from '../lib/api.js';
import { toast } from '../lib/toast';

const STAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:block"><path d="M12 3.5l2.6 5.45 5.9.78-4.35 4.05 1.12 5.87L12 16.9l-5.27 2.75 1.12-5.87L3.5 9.73l5.9-.78z"/></svg>';
const LABEL = 'font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute)';
const BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:99px;padding:13px 22px;font:700 14px/1 var(--sans);cursor:pointer;background:var(--accent);color:var(--accent-ink)';
const GHOST = 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)';

const cap = (n) => Math.min(Number(n) || 0, 99);
const fmtReviews = (n) => { try { return new Intl.NumberFormat().format(Number(n) || 0); } catch { return String(n || 0); } };

function Stat({ label, value }) {
  if (value === undefined || value === null || value === '' || value === 0) return null;
  return (
    <div style={css('background:var(--bg-1);border:1px solid var(--line-soft);border-radius:11px;padding:11px 13px')}>
      <div style={css(LABEL + ';margin-bottom:4px')}>{label}</div>
      <div style={css('font:600 14px/1.2 var(--sans);color:var(--ink);text-transform:capitalize')}>{value}</div>
    </div>
  );
}

export default function BookModal({ open, id, onClose }) {
  const [qty, setQty] = useState(1);
  const [fetched, setFetched] = useState(null);
  const [, force] = useState(0);

  useEffect(() => library.subscribe(() => force((n) => n + 1)), []);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setFetched(null);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, id, onClose]);

  const all = library.getBooks();
  const book = all.find((b) => b.id === id) || all.find((b) => b.title === id) || fetched;

  // Direct URL load (store not hydrated yet, or a book outside the current
  // list): fetch the single book from the API.
  useEffect(() => {
    if (!open || book) return;
    let alive = true;
    api.get('/books/' + encodeURIComponent(id)).then((r) => { if (alive && r && r.book) setFetched(r.book); }).catch(() => {});
    return () => { alive = false; };
  }, [open, id, book]);

  if (!open) return null;

  const shell = (children, label) => (
    <div
      role="dialog" aria-modal="true" aria-label={label}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position:fixed;inset:0;z-index:8300;background:rgba(0,0,0,.66);display:grid;place-items:start center;padding:max(22px,4vh) 18px;overflow:auto')}
    >
      <div style={css('width:min(880px,100%);background:var(--panel);border:1px solid var(--line);border-radius:22px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        {children}
      </div>
    </div>
  );

  const closeBtn = (
    <button type="button" aria-label="Close" onClick={onClose} style={css('position:absolute;top:14px;right:14px;z-index:4;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--ink-soft);cursor:pointer')}>
      <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 17, 2)} />
    </button>
  );

  if (!book) {
    return shell(
      <div style={css('position:relative;padding:48px 28px;text-align:center')}>
        {closeBtn}
        <div style={css('font-family:var(--serif);font-size:22px;font-weight:700;margin-bottom:8px')}>We could not find that book</div>
        <p style={css('color:var(--ink-soft);font-size:14px;margin:0 0 20px')}>It may have sold out or been removed from the shelf.</p>
        <a href="#library" onClick={onClose} style={css(BTN + ';text-decoration:none')}>Browse the library</a>
      </div>,
      'Book not found'
    );
  }

  const stock = Number(book.stock);
  const hasStock = !Number.isFinite(stock) || stock > 0;
  const maxQty = Math.max(1, cap(Number.isFinite(stock) ? stock : 99));
  const avail = !Number.isFinite(stock)
    ? { text: 'In stock', color: 'var(--accent-2)' }
    : stock <= 0
      ? { text: 'Out of stock', color: 'var(--accent-3)' }
      : stock <= 10
        ? { text: 'Only ' + stock + ' left', color: 'var(--accent)' }
        : { text: 'In stock', color: 'var(--accent-2)' };
  const wished = store.inWishlist(book.title);
  const moods = Array.isArray(book.mood) ? book.mood : [];
  const related = all.filter((b) => b.genre === book.genre && b.id !== book.id).slice(0, 4);

  const addToCart = () => {
    if (!hasStock) return;
    store.addToCart(book.title, book.price, qty);
    toast.success(qty > 1 ? qty + ' copies of ' + book.title + ' added to your bag.' : book.title + ' added to your bag.');
  };
  const toggleWish = () => {
    const added = store.toggleWish(book.title);
    toast.success(added ? book.title + ' saved to your wishlist.' : book.title + ' removed from your wishlist.');
  };
  const stepQty = (d) => setQty((q) => Math.min(maxQty, Math.max(1, q + d)));

  return shell(
    <div style={css('position:relative')}>
      {closeBtn}
      <div style={css('display:flex;gap:0;flex-wrap:wrap')}>
        {/* cover side */}
        <div style={css('flex:1 1 260px;min-width:240px;background:linear-gradient(160deg,var(--panel-2),var(--bg-1));padding:34px;display:grid;place-items:center')}>
          <div style={css('width:min(220px,60%);aspect-ratio:2/3;border-radius:14px;background:' + (book.tint || 'var(--raised)') + ';box-shadow:0 26px 60px rgba(0,0,0,.5);display:flex;align-items:flex-end;padding:22px;position:relative;overflow:hidden')}>
            <div style={css('position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.14),transparent 42%,rgba(0,0,0,.42))')} />
            <div style={css('position:absolute;top:0;bottom:0;left:10px;width:2px;background:rgba(255,255,255,.2)')} />
            {book.lang ? <div style={css('position:absolute;top:13px;right:13px;z-index:3;padding:4px 9px;border-radius:99px;background:rgba(0,0,0,.45);color:#fff;font-size:11px;font-weight:700')}>{book.lang}</div> : null}
            <div style={css('position:relative;z-index:2')}>
              <div style={css('font-family:var(--serif);font-size:21px;font-weight:700;color:#fff;line-height:1.12')}>{book.title}</div>
              <div style={css('font-size:12.5px;color:rgba(255,255,255,.82);margin-top:5px')}>{book.author}</div>
            </div>
          </div>
        </div>

        {/* detail side */}
        <div style={css('flex:1 1 360px;min-width:300px;padding:30px 30px 26px')}>
          {book.genre ? <div style={css(LABEL + ';color:var(--accent);margin-bottom:8px')}>{book.genre}</div> : null}
          <h2 style={css('font-family:var(--serif);font-size:clamp(24px,3.4vw,32px);font-weight:700;line-height:1.05;letter-spacing:-.02em;margin:0 0 4px')}>{book.title}</h2>
          <div style={css('color:var(--ink-soft);font-size:14.5px;margin-bottom:14px')}>by {book.author}</div>

          <div style={css('display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px')}>
            <div style={css('display:flex;align-items:center;gap:5px;color:var(--accent-2);font:600 14px/1 var(--mono)')}>
              <Svg as="span" style={{ display: 'inline-grid' }} html={STAR} /> {book.rating}
              {book.reviews ? <span style={css('color:var(--ink-mute);font-size:12px')}>&nbsp;({fmtReviews(book.reviews)} reviews)</span> : null}
            </div>
            <div style={css('font-family:var(--serif);font-size:24px;font-weight:700')}>{book.price}</div>
            <div style={css('display:inline-flex;align-items:center;gap:6px;font:600 12px/1 var(--mono);color:' + avail.color)}>
              <span style={css('width:7px;height:7px;border-radius:50%;background:' + avail.color)} /> {avail.text}
            </div>
          </div>

          {/* qty + actions */}
          <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px')}>
            {hasStock ? (
              <div style={css('display:flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:99px;padding:4px')}>
                <button type="button" aria-label="Decrease quantity" onClick={() => stepQty(-1)} disabled={qty <= 1} style={css('display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:none;background:transparent;color:var(--ink);cursor:pointer' + (qty <= 1 ? ';opacity:.4;cursor:default' : ''))}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('minus', 15, 2.2)} /></button>
                <span style={css('min-width:26px;text-align:center;font:700 15px/1 var(--mono)')}>{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => stepQty(1)} disabled={qty >= maxQty} style={css('display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:none;background:transparent;color:var(--ink);cursor:pointer' + (qty >= maxQty ? ';opacity:.4;cursor:default' : ''))}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('plus', 15, 2.2)} /></button>
              </div>
            ) : null}
            <button type="button" onClick={addToCart} disabled={!hasStock} style={css(BTN + (hasStock ? '' : ';opacity:.5;cursor:default'))}>
              <Svg as="span" style={{ display: 'inline-grid' }} html={icon('bag', 16, 1.9)} /> {hasStock ? 'Add to bag' : 'Sold out'}
            </button>
            <button type="button" onClick={toggleWish} aria-pressed={wished ? 'true' : 'false'} style={css(BTN + ';' + GHOST + (wished ? ';color:var(--accent);border-color:var(--accent)' : ''))}>
              <Svg as="span" style={{ display: 'inline-grid' }} html={icon('heart', 16, 1.9)} /> {wished ? 'Saved' : 'Save'}
            </button>
          </div>

          {book.summary ? <p style={css('color:var(--ink-soft);font-size:14.5px;line-height:1.65;margin:0 0 18px')}>{book.summary}</p> : null}

          {book.notes ? (
            <div style={css('display:flex;align-items:center;gap:9px;margin-bottom:18px;padding:11px 14px;background:var(--bg-1);border:1px solid var(--line-soft);border-radius:11px')}>
              <span style={css('color:var(--accent);display:grid;flex-shrink:0')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('cup', 16, 1.7)} /></span>
              <div><span style={css(LABEL)}>Tasting notes</span><div style={css('font:500 13.5px/1.3 var(--sans);color:var(--ink);margin-top:2px')}>{book.notes}</div></div>
            </div>
          ) : null}

          <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:18px')}>
            <Stat label="Roast" value={book.roast} />
            <Stat label="Pace" value={book.pace} />
            <Stat label="Ending" value={book.ending} />
            <Stat label="Pages" value={book.pages} />
            <Stat label="Published" value={book.year} />
            <Stat label="Language" value={book.lang || 'English'} />
          </div>

          {moods.length ? (
            <div style={css('margin-bottom:4px')}>
              <div style={css(LABEL + ';margin-bottom:8px')}>Moods</div>
              <div style={css('display:flex;flex-wrap:wrap;gap:7px')}>
                {moods.map((m) => <span key={m} style={css('padding:5px 12px;border-radius:99px;border:1px solid var(--line);color:var(--ink-soft);font:500 12.5px/1 var(--sans);text-transform:capitalize')}>{m}</span>)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {related.length ? (
        <div style={css('border-top:1px solid var(--line-soft);padding:22px 30px 26px')}>
          <div style={css(LABEL + ';margin-bottom:14px')}>More in {book.genre}</div>
          <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:14px')}>
            {related.map((r) => (
              <a key={r.id} href={'#book/' + r.id} style={css('text-decoration:none;color:inherit')}>
                <div style={css('aspect-ratio:2/3;border-radius:10px;background:' + (r.tint || 'var(--raised)') + ';box-shadow:0 12px 28px rgba(0,0,0,.36);display:flex;align-items:flex-end;padding:12px;position:relative;overflow:hidden;margin-bottom:8px')}>
                  <div style={css('position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.1),transparent 45%,rgba(0,0,0,.4))')} />
                  <div style={css('position:relative;z-index:2;font-family:var(--serif);font-size:13px;font-weight:700;color:#fff;line-height:1.1')}>{r.title}</div>
                </div>
                <div style={css('font-family:var(--mono);font-size:11.5px;color:var(--accent-2);display:flex;align-items:center;gap:4px')}><Svg as="span" style={{ display: 'inline-grid' }} html={STAR} /> {r.rating} <span style={css('color:var(--ink-mute);margin-left:auto')}>{r.price}</span></div>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>,
    book.title
  );
}
