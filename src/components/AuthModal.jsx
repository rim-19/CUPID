import React, { useEffect, useRef, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { account } from '../lib/account';
import { toast } from '../lib/toast';
import { store } from '../lib/store';
import { rsvp } from '../lib/rsvp';
import { eventById } from '../lib/eventsData.js';

const LABEL = 'font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;display:block';
const FIELD = 'width:100%;background:var(--bg-1);border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);font:500 14px/1.3 var(--sans);outline:none';
const BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:99px;padding:13px 22px;font:700 14px/1 var(--sans);cursor:pointer;background:var(--accent);color:var(--accent-ink)';
const GHOST = 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)';

export default function AuthModal({ open, onClose }) {
  const [mode, setMode] = useState('in'); // 'in' | 'up'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const firstRef = useRef(null);

  useEffect(() => account.subscribe(() => force((n) => n + 1)), []);
  useEffect(() => rsvp.subscribe(() => force((n) => n + 1)), []);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setMode('in');
    const t = setTimeout(() => firstRef.current && firstRef.current.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const user = account.current();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const r = mode === 'up'
      ? await account.signUp(form.name, form.email, form.password)
      : await account.signIn(form.email, form.password);
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Something went wrong.'); return; }
    setForm({ name: '', email: '', password: '' });
  };

  const forgot = async () => {
    const email = form.email.trim();
    if (!email) { setError('Enter your email above first, then tap reset.'); return; }
    setError('');
    await account.requestReset(email);
    toast.success('If that email is registered, a reset link is on its way.');
  };

  const card = (children) => (
    <div
      role="dialog" aria-modal="true" aria-label="Account"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position:fixed;inset:0;z-index:8200;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:22px;overflow:auto')}
    >
      <div style={css('width:min(460px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        {children}
      </div>
    </div>
  );

  const head = (title) => (
    <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line-soft)')}>
      <div style={css('display:flex;align-items:center;gap:10px')}>
        <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={icon('heart', 18, 1.8)} />
        <div style={css('font-family:var(--serif);font-size:19px;font-weight:700')}>{title}</div>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
        <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 16, 2)} />
      </button>
    </div>
  );

  if (user) {
    const going = rsvp.list().map((id) => eventById(id)).filter(Boolean);
    const initial = (user.name.trim()[0] || 'C').toUpperCase();
    return card(
      <>
        {head('Your account')}
        <div style={css('padding:24px 22px 26px')}>
          <div style={css('display:flex;align-items:center;gap:14px;margin-bottom:22px')}>
            <div style={css('width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 32% 28%,var(--raised),var(--panel-2));border:1px solid var(--line);font-family:var(--serif);font-weight:700;font-size:22px;color:var(--accent)')}>{initial}</div>
            <div>
              <div style={css('font-family:var(--serif);font-size:20px;font-weight:700')}>{user.name}</div>
              <div style={css('font-family:var(--mono);font-size:12px;color:var(--ink-mute)')}>{user.email}</div>
            </div>
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px')}>
            <a href="#library" onClick={onClose} style={css('text-decoration:none;background:var(--bg-1);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:block')}>
              <div style={css('font-family:var(--serif);font-size:26px;font-weight:700;color:var(--ink)')}>{store.wishCount()}</div>
              <div style={css('font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-mute);margin-top:2px')}>On your wishlist</div>
            </a>
            <a href="#events" onClick={onClose} style={css('text-decoration:none;background:var(--bg-1);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:block')}>
              <div style={css('font-family:var(--serif);font-size:26px;font-weight:700;color:var(--ink)')}>{going.length}</div>
              <div style={css('font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-mute);margin-top:2px')}>Events reserved</div>
            </a>
          </div>
          {going.length ? (
            <div style={css('margin-bottom:22px')}>
              <div style={css(LABEL)}>You are going to</div>
              <div style={css('display:flex;flex-direction:column;gap:8px')}>
                {going.map((ev) => (
                  <a key={ev.id} href={'#event/' + ev.id} onClick={onClose} style={css('display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink-soft);font-size:14px;background:var(--bg-1);border:1px solid var(--line-soft);border-radius:10px;padding:10px 12px')}>
                    <span style={css('color:var(--accent);display:grid')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon(ev.icon, 15, 1.7)} /></span>
                    <span style={css('font-weight:600;color:var(--ink)')}>{ev.type}</span>
                    <span style={css('color:var(--ink-mute);font-family:var(--mono);font-size:11.5px;margin-left:auto')}>{ev.month} {ev.day}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {user.verified === false ? (
            <div style={css('display:flex;align-items:center;gap:8px;margin-bottom:14px;color:var(--accent-3);font-family:var(--mono);font-size:11.5px')}>
              <Svg as="span" style={{ display: 'inline-grid' }} html={icon('mail', 14, 1.8)} /> Confirm your email in account settings.
            </div>
          ) : null}
          <a href="#account" onClick={onClose} style={css(BTN + ';width:100%;text-decoration:none;margin-bottom:10px')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('compass', 16, 1.9)} /> Manage account
          </a>
          <button type="button" onClick={() => { account.signOut(); setMode('in'); }} style={css(BTN + ';' + GHOST + ';width:100%')}>Sign out</button>
        </div>
      </>
    );
  }

  return card(
    <>
      {head(mode === 'up' ? 'Create your account' : 'Welcome back')}
      <form onSubmit={submit} style={css('padding:22px')}>
        <div style={css('display:flex;gap:6px;background:var(--bg-1);border:1px solid var(--line);border-radius:99px;padding:4px;margin-bottom:20px')}>
          <button type="button" onClick={() => { setMode('in'); setError(''); }} style={css('flex:1;border:none;border-radius:99px;padding:9px;font:700 13px/1 var(--sans);cursor:pointer;transition:.2s;' + (mode === 'in' ? 'background:var(--accent);color:var(--accent-ink)' : 'background:transparent;color:var(--ink-soft)'))}>Sign in</button>
          <button type="button" onClick={() => { setMode('up'); setError(''); }} style={css('flex:1;border:none;border-radius:99px;padding:9px;font:700 13px/1 var(--sans);cursor:pointer;transition:.2s;' + (mode === 'up' ? 'background:var(--accent);color:var(--accent-ink)' : 'background:transparent;color:var(--ink-soft)'))}>Create account</button>
        </div>

        {mode === 'up' ? (
          <div style={css('margin-bottom:14px')}>
            <label style={css(LABEL)} htmlFor="au-name">Name</label>
            <input id="au-name" ref={mode === 'up' ? firstRef : null} value={form.name} onChange={set('name')} style={css(FIELD)} placeholder="Your name" autoComplete="name" />
          </div>
        ) : null}
        <div style={css('margin-bottom:14px')}>
          <label style={css(LABEL)} htmlFor="au-email">Email</label>
          <input id="au-email" ref={mode === 'in' ? firstRef : null} type="email" value={form.email} onChange={set('email')} style={css(FIELD)} placeholder="you@example.com" autoComplete="email" />
        </div>
        <div style={css('margin-bottom:6px')}>
          <label style={css(LABEL)} htmlFor="au-pass">Password</label>
          <input id="au-pass" type="password" value={form.password} onChange={set('password')} style={css(FIELD)} placeholder={mode === 'up' ? 'at least 8 characters' : 'your password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
        </div>
        {mode === 'in' ? (
          <button type="button" onClick={forgot} style={css('background:none;border:none;padding:0;margin-top:8px;color:var(--accent);font:600 12px/1 var(--sans);cursor:pointer')}>Forgot your password?</button>
        ) : null}

        {error ? <div role="alert" style={css('color:var(--accent-3);font-family:var(--mono);font-size:12.5px;margin-top:12px')}>{error}</div> : null}

        <button type="submit" disabled={busy} style={css(BTN + ';width:100%;margin-top:18px' + (busy ? ';opacity:.6;cursor:default' : ''))}>{busy ? 'One moment...' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
        <div style={css('margin-top:16px;font-family:var(--mono);font-size:11px;color:var(--ink-mute);letter-spacing:.03em;text-align:center')}>
          Passwords are hashed and stored on the server.
        </div>
      </form>
    </>
  );
}
