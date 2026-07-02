import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { account } from '../lib/account';

const FIELD = 'width:100%;background:var(--bg-1);border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);font:500 14px/1.3 var(--sans);outline:none';
const LABEL = 'font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;display:block';
const BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:99px;padding:13px 22px;font:700 14px/1 var(--sans);cursor:pointer;background:var(--accent);color:var(--accent-ink)';
const GHOST = 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)';

/* Rendered when the browser lands on /verify or /reset from an email link.
   mode: 'verify' confirms the email immediately; 'reset' shows a new-password
   form. onClose returns to the homepage (clears the path). */
export default function VerifyResetView({ mode, token, onClose }) {
  const [state, setState] = useState(mode === 'verify' ? 'working' : 'form'); // working|done|error|form
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (mode !== 'verify') return;
    let alive = true;
    (async () => {
      const r = await account.verifyEmail(token);
      if (!alive) return;
      if (r.ok) setState('done');
      else { setError(r.error || 'That confirmation link is invalid or has expired.'); setState('error'); }
    })();
    return () => { alive = false; };
  }, [mode, token]);

  const submitReset = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const r = await account.resetPassword(token, password);
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Could not reset your password.'); return; }
    setState('done');
  };

  const shell = (children) => (
    <div role="dialog" aria-modal="true" aria-label={mode === 'verify' ? 'Confirm email' : 'Reset password'}
      style={css('position:fixed;inset:0;z-index:8600;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:22px;overflow:auto')}>
      <div style={css('width:min(440px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        <div style={css('padding:30px 26px 28px;text-align:center')}>{children}</div>
      </div>
    </div>
  );

  const iconBubble = (name, color) => (
    <div style={css('width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px;background:var(--bg-1);border:1px solid var(--line);color:' + color)}>
      <Svg as="span" style={{ display: 'inline-grid' }} html={icon(name, 24, 1.8)} />
    </div>
  );

  const title = (t) => <div style={css('font-family:var(--serif);font-size:23px;font-weight:700;margin-bottom:8px')}>{t}</div>;
  const body = (t) => <p style={css('color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 20px')}>{t}</p>;
  const home = (label) => <button type="button" onClick={onClose} style={css(BTN + ';width:100%')}>{label}</button>;

  if (mode === 'verify') {
    if (state === 'working') return shell(<>{iconBubble('mail', 'var(--accent)')}{title('Confirming your email')}{body('One moment while we confirm your address...')}</>);
    if (state === 'done') return shell(<>{iconBubble('check', 'var(--accent-2)')}{title('Email confirmed')}{body('Thank you. Your account is all set.')}{home('Continue to Cupid')}</>);
    return shell(<>{iconBubble('close', 'var(--accent-3)')}{title('Link expired')}{body(error)}{home('Back to Cupid')}</>);
  }

  // reset
  if (state === 'done') return shell(<>{iconBubble('check', 'var(--accent-2)')}{title('Password reset')}{body('Your password has been changed. Please sign in with your new password.')}<button type="button" onClick={() => { onClose(); if (typeof window !== 'undefined') window.location.hash = '#signin'; }} style={css(BTN + ';width:100%')}>Sign in</button></>);

  return shell(
    <>
      {iconBubble('lock', 'var(--accent)')}
      {title('Choose a new password')}
      <form onSubmit={submitReset} style={css('text-align:left;margin-top:4px')}>
        <label style={css(LABEL)} htmlFor="rs-pw">New password</label>
        <input id="rs-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} style={css(FIELD)} placeholder="at least 8 characters" />
        {error ? <div role="alert" style={css('color:var(--accent-3);font-family:var(--mono);font-size:12.5px;margin-top:10px')}>{error}</div> : null}
        <button type="submit" disabled={busy} style={css(BTN + ';width:100%;margin-top:16px' + (busy ? ';opacity:.6;cursor:default' : ''))}>{busy ? 'Saving...' : 'Reset password'}</button>
        <button type="button" onClick={onClose} style={css(BTN + ';' + GHOST + ';width:100%;margin-top:10px')}>Cancel</button>
      </form>
    </>
  );
}
