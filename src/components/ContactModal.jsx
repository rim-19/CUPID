import React, { useEffect, useRef, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { api } from '../lib/api.js';
import { account } from '../lib/account';
import { toast } from '../lib/toast';

const LABEL = 'font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;display:block';
const FIELD = 'width:100%;background:var(--bg-1);border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);font:500 14px/1.3 var(--sans);outline:none';
const BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:99px;padding:13px 22px;font:700 14px/1 var(--sans);cursor:pointer;background:var(--accent);color:var(--accent-ink)';
const GHOST = 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)';

export default function ContactModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const u = account.current();
    setForm({ name: u ? u.name : '', email: u ? u.email : '', message: '' });
    setError('');
    const t = setTimeout(() => firstRef.current && firstRef.current.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await api.post('/contact', form);
      setBusy(false);
      toast.success('Thank you. Your message is on its way.');
      onClose();
    } catch (err) {
      setBusy(false);
      setError((err && err.data && err.data.error) || 'Could not send your message. Please try again.');
    }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Contact us"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position:fixed;inset:0;z-index:8400;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:22px;overflow:auto')}
    >
      <div style={css('width:min(480px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line-soft)')}>
          <div style={css('display:flex;align-items:center;gap:10px')}>
            <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={icon('mail', 18, 1.8)} />
            <div style={css('font-family:var(--serif);font-size:19px;font-weight:700')}>Say hello</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 16, 2)} />
          </button>
        </div>
        <form onSubmit={submit} style={css('padding:22px')}>
          <p style={css('color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px')}>Questions about an order, an event, or gift cards? Send a note and we will get back to you.</p>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px')}>
            <div>
              <label style={css(LABEL)} htmlFor="ct-name">Name</label>
              <input id="ct-name" ref={firstRef} value={form.name} onChange={set('name')} style={css(FIELD)} placeholder="Your name" autoComplete="name" />
            </div>
            <div>
              <label style={css(LABEL)} htmlFor="ct-email">Email</label>
              <input id="ct-email" type="email" value={form.email} onChange={set('email')} style={css(FIELD)} placeholder="you@example.com" autoComplete="email" />
            </div>
          </div>
          <div>
            <label style={css(LABEL)} htmlFor="ct-msg">Message</label>
            <textarea id="ct-msg" value={form.message} onChange={set('message')} rows={4} style={css(FIELD + ';resize:vertical;font-family:var(--sans)')} placeholder="How can we help?" />
          </div>
          {error ? <div role="alert" style={css('color:var(--accent-3);font-family:var(--mono);font-size:12.5px;margin-top:12px')}>{error}</div> : null}
          <div style={css('display:flex;gap:10px;margin-top:18px')}>
            <button type="submit" disabled={busy} style={css(BTN + (busy ? ';opacity:.6;cursor:default' : ''))}>{busy ? 'Sending...' : 'Send message'}</button>
            <button type="button" onClick={onClose} style={css(BTN + ';' + GHOST)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
