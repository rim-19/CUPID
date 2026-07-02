import React, { useEffect, useRef, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { library, coverFromColor } from '../lib/library';
import { api } from '../lib/api.js';
import { account } from '../lib/account';
import { toast } from '../lib/toast';

/* Admin gate. Admin is a role on the signed-in account (User.role === 'ADMIN'),
   enforced server-side on every mutation. The panel simply reflects that role:
   an admin sees the management tools, anyone else is asked to sign in with a
   staff account. It manages catalog, events, and articles, and shows recent
   orders, messages, and subscribers read-only. */
const ORDER_STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'SHIPPED', 'CANCELLED', 'REFUNDED'];
const ROASTS = ['Light', 'Med', 'Dark'];
const PACES = ['slow', 'medium', 'fast'];
const ENDINGS = ['hopeful', 'bittersweet', 'open'];
const KNOWN_GENRES = ['Fiction', 'Romance', 'Fantasy', 'Mystery', 'Poetry', 'Nonfiction', "Children's", 'Food & Coffee'];
const ICON_CHOICES = ['cup', 'book', 'heart', 'gift', 'rose', 'sparkle', 'flame', 'moon', 'sun', 'bean', 'compass', 'balloon', 'mist', 'pin'];

const LABEL = 'font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;display:block';
const FIELD = 'width:100%;background:var(--bg-1);border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);font:500 14px/1.3 var(--sans);outline:none';
const BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:99px;padding:11px 18px;font:700 13.5px/1 var(--sans);cursor:pointer;background:var(--accent);color:var(--accent-ink)';
const GHOST = 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)';
const SMALL = 'background:var(--bg-1);border:1px solid var(--line);border-radius:8px;padding:7px 9px;color:var(--ink);font:600 12.5px/1 var(--mono);outline:none;width:100%';
const ROW = 'border:1px solid var(--line-soft);border-radius:12px;padding:12px 14px;margin-bottom:10px';
const ICONBTN = 'display:grid;place-items:center;width:34px;height:34px;border-radius:8px;border:1px solid var(--line);background:transparent;cursor:pointer;flex-shrink:0';

const errMsg = (e, f) => (e && e.data && e.data.error) || f;
const money = (n) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n) || 0); } catch { return '$' + (Number(n) || 0).toFixed(2); } };
const when = (ts) => { try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };

const BLANK = {
  title: '', author: '', price: '20', rating: '4.7', genre: 'Fiction',
  roast: 'Med', lang: '', pace: 'medium', ending: 'hopeful', stock: '40',
  mood: 'cozy, thoughtful', notes: '', color: '#5a3a28',
  summary: '', pages: '', year: '',
};
const EVENT_BLANK = { month: '', day: '', type: '', title: '', time: '', place: '', spots: '', icon: 'cup', desc: '' };
const ARTICLE_BLANK = { title: '', cat: 'Staff picks', date: '', read: '3 min read', excerpt: '', icon: 'cup', body: '' };

export default function AdminPanel({ open, onClose }) {
  const [signedIn, setSignedIn] = useState(() => Boolean(account.current()?.admin));
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('books');
  const firstRef = useRef(null);

  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [books, setBooks] = useState(null);
  const [edits, setEdits] = useState({});
  const [events, setEvents] = useState(null);
  const [articles, setArticles] = useState(null);
  const [orders, setOrders] = useState(null);
  const [messages, setMessages] = useState(null);
  const [subs, setSubs] = useState(null);
  const [auditRows, setAuditRows] = useState(null);
  const [newEvent, setNewEvent] = useState(EVENT_BLANK);
  const [newArticle, setNewArticle] = useState(ARTICLE_BLANK);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // Admin state follows the signed-in account (role-based); update live if the
    // user signs in or out while the panel is open.
    const sync = () => { if (alive) setSignedIn(Boolean(account.current()?.admin)); };
    sync();
    const unsub = account.subscribe(sync);
    const t = setTimeout(() => { if (firstRef.current) firstRef.current.focus(); }, 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { alive = false; unsub(); clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !signedIn) return;
    if (tab === 'books' && books === null) api.get('/books').then((r) => setBooks(r.books || [])).catch(() => setBooks([]));
    if (tab === 'events' && events === null) api.get('/events').then((r) => setEvents(r.events || [])).catch(() => setEvents([]));
    if (tab === 'articles' && articles === null) api.get('/articles').then((r) => setArticles(r.articles || [])).catch(() => setArticles([]));
    if (tab === 'activity' && orders === null) {
      Promise.all([api.get('/admin/orders'), api.get('/admin/messages'), api.get('/admin/subscribers'), api.get('/admin/audit')])
        .then(([o, m, s, a]) => { setOrders(o.orders || []); setMessages(m.messages || []); setSubs(s.subscribers || []); setAuditRows(a.audit || []); })
        .catch(() => { setOrders([]); setMessages([]); setSubs([]); setAuditRows([]); });
    }
  }, [open, signedIn, tab, books, events, articles, orders]);

  if (!open) return null;
  const currentUser = account.current();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const signOut = () => {
    setBooks(null); setEvents(null); setArticles(null); setOrders(null); setMessages(null); setSubs(null); setAuditRows(null);
    account.signOut();
  };

  const setOrderStatus = async (o, status) => {
    setBusy('order:' + o.id);
    try {
      const r = await api.patch('/admin/orders/' + o.id, { status });
      setOrders((list) => (list || []).map((x) => (x.id === o.id ? r.order : x)));
    } catch (err) { toast.error(errMsg(err, 'Could not update the order.')); }
    setBusy('');
  };

  // ----- books -----
  const submitBook = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!form.title.trim()) next.title = true;
    if (!form.author.trim()) next.author = true;
    setErrors(next);
    if (Object.keys(next).length) return;
    const priceN = Number(String(form.price).replace(/[^0-9.]/g, '')) || 0;
    const book = {
      title: form.title.trim(), author: form.author.trim(),
      price: '$' + (priceN % 1 === 0 ? priceN.toFixed(0) : priceN.toFixed(2)),
      rating: String(Number(form.rating) || 0), tint: coverFromColor(form.color),
      lang: form.lang.trim(), roast: form.roast, notes: form.notes.trim() || 'a fresh pour',
      genre: form.genre.trim() || 'Fiction', stock: parseInt(form.stock, 10) || 0,
      mood: form.mood.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean),
      pace: form.pace, ending: form.ending,
      summary: form.summary.trim(), pages: parseInt(form.pages, 10) || 0, year: parseInt(form.year, 10) || 0,
    };
    setBusy('addbook');
    const r = await library.addBook(book);
    setBusy('');
    if (!r.ok) { toast.error(r.error || 'Could not add the book.'); return; }
    toast.success(book.title + ' is on the shelf.');
    setForm({ ...BLANK, genre: form.genre, color: form.color });
    setErrors({});
    api.get('/books').then((res) => setBooks(res.books || [])).catch(() => {});
  };

  const editVal = (b, k) => { const e = edits[b.id] || {}; return e[k] !== undefined ? e[k] : (b[k] != null ? b[k] : ''); };
  const setEdit = (id, k, v) => setEdits((m) => ({ ...m, [id]: { ...(m[id] || {}), [k]: v } }));

  const saveBook = async (b) => {
    setBusy('book:' + b.id);
    try {
      await api.patch('/books/' + b.id, { price: editVal(b, 'price'), stock: Number(editVal(b, 'stock')) });
      toast.success('Updated ' + b.title + '.');
      setEdits((m) => { const n = { ...m }; delete n[b.id]; return n; });
      const res = await api.get('/books'); setBooks(res.books || []);
      library.init();
    } catch (err) { toast.error(errMsg(err, 'Could not update the book.')); }
    setBusy('');
  };

  const deleteBook = async (b) => {
    setBusy('delbook:' + b.id);
    try {
      await api.del('/books/' + b.id);
      toast.success('Removed ' + b.title + '.');
      setBooks((list) => (list || []).filter((x) => x.id !== b.id));
      library.init();
    } catch (err) { toast.error(errMsg(err, 'Could not remove the book.')); }
    setBusy('');
  };

  // Attach a downloadable ebook (PDF/EPUB/MOBI) that buyers receive as a gift.
  const uploadAsset = async (b, file) => {
    if (!file) return;
    setBusy('asset:' + b.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload('/books/' + b.id + '/asset', fd);
      toast.success('Ebook attached to ' + b.title + '.');
      const res = await api.get('/books'); setBooks(res.books || []);
      library.init();
    } catch (err) { toast.error(errMsg(err, 'Could not upload the file.')); }
    setBusy('');
  };

  // ----- events -----
  const addEvent = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!newEvent.title.trim()) { toast.error('Give the event a title.'); return; }
    setBusy('addevent');
    try {
      const payload = { ...newEvent, desc: newEvent.desc.split('\n').map((s) => s.trim()).filter(Boolean) };
      const r = await api.post('/events', payload);
      setEvents((list) => [...(list || []), r.event]);
      setNewEvent(EVENT_BLANK);
      toast.success('Event added.');
    } catch (err) { toast.error(errMsg(err, 'Could not add the event.')); }
    setBusy('');
  };
  const deleteEvent = async (ev) => {
    setBusy('delevent:' + ev.id);
    try { await api.del('/events/' + ev.id); setEvents((list) => (list || []).filter((x) => x.id !== ev.id)); toast.success('Event removed.'); }
    catch (err) { toast.error(errMsg(err, 'Could not remove the event.')); }
    setBusy('');
  };

  // ----- articles -----
  const addArticle = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!newArticle.title.trim()) { toast.error('Give the article a title.'); return; }
    setBusy('addarticle');
    try {
      const r = await api.post('/articles', newArticle);
      setArticles((list) => [...(list || []), r.article]);
      setNewArticle(ARTICLE_BLANK);
      toast.success('Article added.');
    } catch (err) { toast.error(errMsg(err, 'Could not add the article.')); }
    setBusy('');
  };
  const deleteArticle = async (a) => {
    setBusy('delarticle:' + a.id);
    try { await api.del('/articles/' + a.id); setArticles((list) => (list || []).filter((x) => x.id !== a.id)); toast.success('Article removed.'); }
    catch (err) { toast.error(errMsg(err, 'Could not remove the article.')); }
    setBusy('');
  };

  const eset = (k) => (e) => setNewEvent((f) => ({ ...f, [k]: e.target.value }));
  const aset = (k) => (e) => setNewArticle((f) => ({ ...f, [k]: e.target.value }));

  const tabBtn = (id, text) => (
    <button type="button" onClick={() => setTab(id)} style={css('border:none;border-radius:99px;padding:8px 14px;font:700 12.5px/1 var(--sans);cursor:pointer;white-space:nowrap;transition:.2s;' + (tab === id ? 'background:var(--accent);color:var(--accent-ink)' : 'background:transparent;color:var(--ink-soft)'))}>{text}</button>
  );

  const loading = (label) => <div style={css('text-align:center;color:var(--ink-mute);font-family:var(--mono);font-size:12.5px;padding:26px 0')}>{label}</div>;
  const empty = (label) => <div style={css('text-align:center;color:var(--ink-soft);font-size:13.5px;padding:24px 0')}>{label}</div>;

  const cover = coverFromColor(form.color);

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Admin"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:22px;overflow:auto')}
    >
      <div style={css('width:min(660px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line-soft)')}>
          <div style={css('display:flex;align-items:center;gap:10px')}>
            <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={icon('lock', 18, 1.8)} />
            <div style={css('font-family:var(--serif);font-size:19px;font-weight:700')}>{signedIn ? 'Manage Cupid' : 'Admin access'}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 16, 2)} />
          </button>
        </div>

        {!signedIn ? (
          <div style={css('padding:24px 22px 26px')}>
            <p style={css('color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 16px')}>
              {currentUser
                ? `You are signed in as ${currentUser.email}, but this account does not have admin access.`
                : 'Managing the shop requires an admin account. Please sign in with your staff account to continue.'}
            </p>
            <div style={css('display:flex;gap:10px;margin-top:4px')}>
              {currentUser ? null : (
                <button type="button" ref={firstRef} onClick={() => { window.location.hash = '#signin'; }} style={css(BTN)}>Sign in</button>
              )}
              <button type="button" onClick={onClose} style={css(BTN + ';' + GHOST)}>Close</button>
            </div>
          </div>
        ) : (
          <div style={css('padding:16px 22px 22px')}>
            <div style={css('display:flex;gap:6px;background:var(--bg-1);border:1px solid var(--line);border-radius:99px;padding:4px;margin-bottom:18px;overflow-x:auto')}>
              {tabBtn('books', 'Books')}
              {tabBtn('events', 'Events')}
              {tabBtn('articles', 'Articles')}
              {tabBtn('activity', 'Activity')}
              <button type="button" onClick={signOut} style={css(BTN + ';' + GHOST + ';margin-left:auto;padding:8px 14px')}>Sign out</button>
            </div>

            <div style={css('max-height:min(70vh,640px);overflow:auto;padding-right:2px')}>
              {tab === 'books' ? (
                <div>
                  <form onSubmit={submitBook} style={css(ROW + ';padding:16px')}>
                    <div style={css('display:grid;grid-template-columns:1.4fr 1fr;gap:16px;align-items:start')}>
                      <div style={css('display:flex;flex-direction:column;gap:12px')}>
                        <div>
                          <label style={css(LABEL)} htmlFor="bk-title">Title</label>
                          <input id="bk-title" ref={firstRef} value={form.title} onChange={set('title')} style={css(FIELD + (errors.title ? ';border-color:var(--accent-3)' : ''))} placeholder="The Lantern Orchard" />
                        </div>
                        <div>
                          <label style={css(LABEL)} htmlFor="bk-author">Author</label>
                          <input id="bk-author" value={form.author} onChange={set('author')} style={css(FIELD + (errors.author ? ';border-color:var(--accent-3)' : ''))} placeholder="M. Ashgrove" />
                        </div>
                        <div>
                          <label style={css(LABEL)} htmlFor="bk-mood">Moods <span style={css('text-transform:none;letter-spacing:0;color:var(--ink-mute)')}>(comma separated)</span></label>
                          <input id="bk-mood" value={form.mood} onChange={set('mood')} style={css(FIELD)} placeholder="cozy, thoughtful" />
                        </div>
                      </div>
                      <div style={css('display:flex;flex-direction:column;gap:10px;align-items:center')}>
                        <div aria-hidden="true" style={css('width:112px;aspect-ratio:2/3;border-radius:12px;background:' + cover + ';box-shadow:0 16px 36px rgba(0,0,0,.4);display:flex;align-items:flex-end;padding:12px;position:relative;overflow:hidden')}>
                          <div style={css('position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.12),transparent 42%,rgba(0,0,0,.4))')} />
                          <div style={css('position:relative;z-index:2')}>
                            <div style={css('font-family:var(--serif);font-size:13px;font-weight:700;color:#fff;line-height:1.1')}>{form.title || 'Title'}</div>
                            <div style={css('font-size:9.5px;color:rgba(255,255,255,.8);margin-top:3px')}>{form.author || 'Author'}</div>
                          </div>
                        </div>
                        <label style={css('display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;color:var(--ink-mute);cursor:pointer')}>
                          <input type="color" value={form.color} onChange={set('color')} style={css('width:28px;height:28px;border:none;background:none;padding:0;cursor:pointer')} /> cover
                        </label>
                      </div>
                    </div>
                    <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px')}>
                      <div style={css('grid-column:span 2')}>
                        <label style={css(LABEL)} htmlFor="bk-genre">Genre</label>
                        <input id="bk-genre" list="admin-genres" value={form.genre} onChange={set('genre')} style={css(FIELD)} />
                        <datalist id="admin-genres">{KNOWN_GENRES.map((g) => <option key={g} value={g} />)}</datalist>
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-price">Price</label>
                        <input id="bk-price" type="number" min="0" step="1" value={form.price} onChange={set('price')} style={css(FIELD)} />
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-stock">Stock</label>
                        <input id="bk-stock" type="number" min="0" step="1" value={form.stock} onChange={set('stock')} style={css(FIELD)} />
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-rating">Rating</label>
                        <input id="bk-rating" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set('rating')} style={css(FIELD)} />
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-pages">Pages</label>
                        <input id="bk-pages" type="number" min="0" step="1" value={form.pages} onChange={set('pages')} style={css(FIELD)} placeholder="320" />
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-year">Published</label>
                        <input id="bk-year" type="number" min="0" step="1" value={form.year} onChange={set('year')} style={css(FIELD)} placeholder="2024" />
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-roast">Roast</label>
                        <select id="bk-roast" value={form.roast} onChange={set('roast')} style={css(FIELD)}>{ROASTS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-pace">Pace</label>
                        <select id="bk-pace" value={form.pace} onChange={set('pace')} style={css(FIELD)}>{PACES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                      </div>
                      <div>
                        <label style={css(LABEL)} htmlFor="bk-ending">Ending</label>
                        <select id="bk-ending" value={form.ending} onChange={set('ending')} style={css(FIELD)}>{ENDINGS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                      </div>
                    </div>
                    <div style={css('margin-top:12px')}>
                      <label style={css(LABEL)} htmlFor="bk-summary">Summary <span style={css('text-transform:none;letter-spacing:0;color:var(--ink-mute)')}>(shown on the book page)</span></label>
                      <textarea id="bk-summary" value={form.summary} onChange={set('summary')} rows={3} style={css(FIELD + ';resize:vertical;font-family:var(--sans)')} placeholder="A sentence or two about the book." />
                    </div>
                    <button type="submit" disabled={busy === 'addbook'} style={css(BTN + ';margin-top:14px' + (busy === 'addbook' ? ';opacity:.6;cursor:default' : ''))}>
                      <Svg as="span" style={{ display: 'inline-grid' }} html={icon('plus', 15, 2.2)} /> {busy === 'addbook' ? 'Adding...' : 'Add to shelf'}
                    </button>
                  </form>

                  <div style={css(LABEL + ';margin:16px 0 10px')}>Catalog {books ? '(' + books.length + ')' : ''}</div>
                  {books === null ? loading('Loading catalog...') : books.length === 0 ? empty('No books yet.') : books.map((b) => (
                    <div key={b.id} style={css(ROW)}>
                      <div style={css('display:flex;align-items:center;gap:12px')}>
                        <div aria-hidden="true" style={css('width:30px;height:44px;border-radius:5px;background:' + (b.tint || 'var(--raised)') + ';flex-shrink:0;box-shadow:0 6px 14px rgba(0,0,0,.35)')} />
                        <div style={css('min-width:0;flex:1')}>
                          <div style={css('font-family:var(--serif);font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.title}</div>
                          <div style={css('font-size:12px;color:var(--ink-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.author}</div>
                        </div>
                        <button type="button" aria-label={'Delete ' + b.title} onClick={() => deleteBook(b)} disabled={busy === 'delbook:' + b.id} style={css(ICONBTN + ';color:var(--accent-3)' + (busy === 'delbook:' + b.id ? ';opacity:.5' : ''))}>
                          <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 15, 2)} />
                        </button>
                      </div>
                      <div style={css('display:flex;align-items:end;gap:10px;margin-top:10px')}>
                        <div style={css('flex:1')}>
                          <label style={css(LABEL + ';margin-bottom:4px')} htmlFor={'pr-' + b.id}>Price</label>
                          <input id={'pr-' + b.id} value={editVal(b, 'price')} onChange={(e) => setEdit(b.id, 'price', e.target.value)} style={css(SMALL)} />
                        </div>
                        <div style={css('flex:1')}>
                          <label style={css(LABEL + ';margin-bottom:4px')} htmlFor={'st-' + b.id}>Stock</label>
                          <input id={'st-' + b.id} type="number" min="0" value={editVal(b, 'stock')} onChange={(e) => setEdit(b.id, 'stock', e.target.value)} style={css(SMALL)} />
                        </div>
                        <button type="button" onClick={() => saveBook(b)} disabled={!edits[b.id] || busy === 'book:' + b.id} style={css(BTN + ';padding:8px 14px' + (!edits[b.id] || busy === 'book:' + b.id ? ';opacity:.5;cursor:default' : ''))}>{busy === 'book:' + b.id ? 'Saving' : 'Save'}</button>
                      </div>
                      <div style={css('display:flex;align-items:center;gap:10px;margin-top:10px')}>
                        <div style={css('flex:1;font-family:var(--mono);font-size:11px;color:' + (b.digitalGift ? 'var(--accent)' : 'var(--ink-mute)'))}>
                          {b.digitalGift ? 'Ebook gift: attached' : 'Ebook gift: none'}
                        </div>
                        <label style={css(BTN + ';' + GHOST + ';padding:8px 14px;cursor:pointer' + (busy === 'asset:' + b.id ? ';opacity:.5;cursor:default' : ''))}>
                          {busy === 'asset:' + b.id ? 'Uploading...' : (b.digitalGift ? 'Replace ebook' : 'Upload ebook')}
                          <input type="file" accept=".pdf,.epub,.mobi" disabled={busy === 'asset:' + b.id} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; uploadAsset(b, f); }} style={{ display: 'none' }} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'events' ? (
                <div>
                  <form onSubmit={addEvent} style={css(ROW + ';padding:16px')}>
                    <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:10px')}>
                      <div style={css('grid-column:span 2')}><label style={css(LABEL)} htmlFor="ev-title">Title</label><input id="ev-title" ref={firstRef} value={newEvent.title} onChange={eset('title')} style={css(FIELD)} placeholder="Latte art workshop" /></div>
                      <div><label style={css(LABEL)} htmlFor="ev-type">Type</label><input id="ev-type" value={newEvent.type} onChange={eset('type')} style={css(FIELD)} placeholder="Workshop" /></div>
                      <div>
                        <label style={css(LABEL)} htmlFor="ev-icon">Icon</label>
                        <select id="ev-icon" value={newEvent.icon} onChange={eset('icon')} style={css(FIELD)}>{ICON_CHOICES.map((i) => <option key={i} value={i}>{i}</option>)}</select>
                      </div>
                      <div><label style={css(LABEL)} htmlFor="ev-month">Month</label><input id="ev-month" value={newEvent.month} onChange={eset('month')} style={css(FIELD)} placeholder="Jul" /></div>
                      <div><label style={css(LABEL)} htmlFor="ev-day">Day</label><input id="ev-day" value={newEvent.day} onChange={eset('day')} style={css(FIELD)} placeholder="18" /></div>
                      <div><label style={css(LABEL)} htmlFor="ev-time">Time</label><input id="ev-time" value={newEvent.time} onChange={eset('time')} style={css(FIELD)} placeholder="6:00 PM" /></div>
                      <div><label style={css(LABEL)} htmlFor="ev-spots">Spots</label><input id="ev-spots" value={newEvent.spots} onChange={eset('spots')} style={css(FIELD)} placeholder="12" /></div>
                      <div style={css('grid-column:span 4')}><label style={css(LABEL)} htmlFor="ev-place">Place</label><input id="ev-place" value={newEvent.place} onChange={eset('place')} style={css(FIELD)} placeholder="The reading room" /></div>
                      <div style={css('grid-column:span 4')}><label style={css(LABEL)} htmlFor="ev-desc">Description <span style={css('text-transform:none;letter-spacing:0;color:var(--ink-mute)')}>(one paragraph per line)</span></label><textarea id="ev-desc" value={newEvent.desc} onChange={eset('desc')} rows={2} style={css(FIELD + ';resize:vertical;font-family:var(--sans)')} /></div>
                    </div>
                    <button type="submit" disabled={busy === 'addevent'} style={css(BTN + ';margin-top:12px' + (busy === 'addevent' ? ';opacity:.6;cursor:default' : ''))}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('plus', 15, 2.2)} /> {busy === 'addevent' ? 'Adding...' : 'Add event'}</button>
                  </form>
                  <div style={css(LABEL + ';margin:16px 0 10px')}>Events {events ? '(' + events.length + ')' : ''}</div>
                  {events === null ? loading('Loading events...') : events.length === 0 ? empty('No events yet.') : events.map((ev) => (
                    <div key={ev.id} style={css(ROW + ';display:flex;align-items:center;gap:12px')}>
                      <span style={css('color:var(--accent);display:grid;flex-shrink:0')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon(ev.icon || 'cup', 17, 1.7)} /></span>
                      <div style={css('min-width:0;flex:1')}>
                        <div style={css('font-family:var(--serif);font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{ev.title || ev.type || 'Untitled'}</div>
                        <div style={css('font-size:12px;color:var(--ink-mute)')}>{[ev.month, ev.day].filter(Boolean).join(' ')}{ev.time ? ' . ' + ev.time : ''}{ev.place ? ' . ' + ev.place : ''}</div>
                      </div>
                      <button type="button" aria-label="Delete event" onClick={() => deleteEvent(ev)} disabled={busy === 'delevent:' + ev.id} style={css(ICONBTN + ';color:var(--accent-3)' + (busy === 'delevent:' + ev.id ? ';opacity:.5' : ''))}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 15, 2)} /></button>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'articles' ? (
                <div>
                  <form onSubmit={addArticle} style={css(ROW + ';padding:16px')}>
                    <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:10px')}>
                      <div style={css('grid-column:span 2')}><label style={css(LABEL)} htmlFor="ar-title">Title</label><input id="ar-title" ref={firstRef} value={newArticle.title} onChange={aset('title')} style={css(FIELD)} placeholder="Brewing for slow mornings" /></div>
                      <div><label style={css(LABEL)} htmlFor="ar-cat">Category</label><input id="ar-cat" value={newArticle.cat} onChange={aset('cat')} style={css(FIELD)} /></div>
                      <div>
                        <label style={css(LABEL)} htmlFor="ar-icon">Icon</label>
                        <select id="ar-icon" value={newArticle.icon} onChange={aset('icon')} style={css(FIELD)}>{ICON_CHOICES.map((i) => <option key={i} value={i}>{i}</option>)}</select>
                      </div>
                      <div style={css('grid-column:span 2')}><label style={css(LABEL)} htmlFor="ar-date">Date</label><input id="ar-date" value={newArticle.date} onChange={aset('date')} style={css(FIELD)} placeholder="Jul 2026" /></div>
                      <div style={css('grid-column:span 2')}><label style={css(LABEL)} htmlFor="ar-read">Read time</label><input id="ar-read" value={newArticle.read} onChange={aset('read')} style={css(FIELD)} /></div>
                      <div style={css('grid-column:span 4')}><label style={css(LABEL)} htmlFor="ar-ex">Excerpt</label><textarea id="ar-ex" value={newArticle.excerpt} onChange={aset('excerpt')} rows={2} style={css(FIELD + ';resize:vertical;font-family:var(--sans)')} /></div>
                      <div style={css('grid-column:span 4')}><label style={css(LABEL)} htmlFor="ar-body">Body <span style={css('text-transform:none;letter-spacing:0;color:var(--ink-mute)')}>(optional)</span></label><textarea id="ar-body" value={newArticle.body} onChange={aset('body')} rows={3} style={css(FIELD + ';resize:vertical;font-family:var(--sans)')} /></div>
                    </div>
                    <button type="submit" disabled={busy === 'addarticle'} style={css(BTN + ';margin-top:12px' + (busy === 'addarticle' ? ';opacity:.6;cursor:default' : ''))}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('plus', 15, 2.2)} /> {busy === 'addarticle' ? 'Adding...' : 'Add article'}</button>
                  </form>
                  <div style={css(LABEL + ';margin:16px 0 10px')}>Articles {articles ? '(' + articles.length + ')' : ''}</div>
                  {articles === null ? loading('Loading articles...') : articles.length === 0 ? empty('No articles yet.') : articles.map((a) => (
                    <div key={a.id} style={css(ROW + ';display:flex;align-items:center;gap:12px')}>
                      <span style={css('color:var(--accent);display:grid;flex-shrink:0')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon(a.icon || 'book', 17, 1.7)} /></span>
                      <div style={css('min-width:0;flex:1')}>
                        <div style={css('font-family:var(--serif);font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{a.title}</div>
                        <div style={css('font-size:12px;color:var(--ink-mute)')}>{[a.cat, a.date, a.read].filter(Boolean).join(' . ')}</div>
                      </div>
                      <button type="button" aria-label="Delete article" onClick={() => deleteArticle(a)} disabled={busy === 'delarticle:' + a.id} style={css(ICONBTN + ';color:var(--accent-3)' + (busy === 'delarticle:' + a.id ? ';opacity:.5' : ''))}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 15, 2)} /></button>
                    </div>
                  ))}
                </div>
              ) : null}

              {tab === 'activity' ? (
                <div>
                  {orders === null ? loading('Loading activity...') : (
                    <div>
                      <div style={css(LABEL + ';margin-bottom:10px')}>Recent orders ({orders.length})</div>
                      {orders.length === 0 ? empty('No orders yet.') : orders.slice(0, 25).map((o) => (
                        <div key={o.id} style={css(ROW + ';display:flex;align-items:center;gap:12px')}>
                          <div style={css('min-width:0;flex:1')}>
                            <div style={css('font-family:var(--mono);font-size:11.5px;color:var(--ink-mute)')}>{when(o.createdAt)}{o.userId ? '' : ' . guest'}</div>
                            <div style={css('font-size:13px;color:var(--ink-soft)')}>{(o.items || []).reduce((n, it) => n + (it.qty || 0), 0)} items . {money(o.total)}</div>
                          </div>
                          <select aria-label="Order status" value={o.status} disabled={busy === 'order:' + o.id} onChange={(e) => setOrderStatus(o, e.target.value)} style={css(SMALL + ';width:auto')}>
                            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                          </select>
                        </div>
                      ))}

                      <div style={css(LABEL + ';margin:18px 0 10px')}>Messages ({messages ? messages.length : 0})</div>
                      {!messages || messages.length === 0 ? empty('No messages yet.') : messages.slice().reverse().slice(0, 20).map((m) => (
                        <div key={m.id} style={css(ROW)}>
                          <div style={css('display:flex;justify-content:space-between;gap:10px;margin-bottom:4px')}>
                            <div style={css('font-family:var(--serif);font-size:14px;font-weight:700')}>{m.name || 'Anonymous'}</div>
                            <div style={css('font-family:var(--mono);font-size:11px;color:var(--ink-mute)')}>{when(m.createdAt)}</div>
                          </div>
                          <div style={css('font-family:var(--mono);font-size:11.5px;color:var(--accent);margin-bottom:6px')}>{m.email}</div>
                          <div style={css('font-size:13px;color:var(--ink-soft);line-height:1.5')}>{m.message}</div>
                        </div>
                      ))}

                      <div style={css(LABEL + ';margin:18px 0 10px')}>Subscribers ({subs ? subs.length : 0})</div>
                      {!subs || subs.length === 0 ? empty('No subscribers yet.') : (
                        <div style={css(ROW)}>
                          {subs.map((s, i) => (
                            <div key={i} style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0' + (i ? ';border-top:1px solid var(--line-soft)' : ''))}>
                              <span style={css('font-family:var(--mono);font-size:12.5px;color:var(--ink)')}>{s.email}</span>
                              <span style={css('font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:' + (s.confirmed ? 'var(--accent-2)' : 'var(--ink-mute)'))}>{s.confirmed ? 'confirmed' : 'pending'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={css(LABEL + ';margin:18px 0 10px')}>Audit log ({auditRows ? auditRows.length : 0})</div>
                      {!auditRows || auditRows.length === 0 ? empty('No admin actions logged yet.') : (
                        <div style={css(ROW)}>
                          {auditRows.slice(0, 40).map((a, i) => (
                            <div key={a.id} style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0' + (i ? ';border-top:1px solid var(--line-soft)' : ''))}>
                              <span style={css('min-width:0;font-family:var(--mono);font-size:11.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
                                <span style={css('color:var(--accent-2)')}>{a.action}</span>{a.detail ? ' . ' + a.detail : ''}
                              </span>
                              <span style={css('font-family:var(--mono);font-size:10.5px;color:var(--ink-mute);white-space:nowrap')}>{a.actorEmail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
