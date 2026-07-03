import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { account } from '../lib/account';
import { toast } from '../lib/toast';

const LABEL = 'font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;display:block';
const FIELD = 'width:100%;background:var(--bg-1);border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);font:500 14px/1.3 var(--sans);outline:none';
const BTN = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:99px;padding:12px 20px;font:700 13.5px/1 var(--sans);cursor:pointer;background:var(--accent);color:var(--accent-ink)';
const GHOST = 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)';
const SECTION = 'border:1px solid var(--line-soft);border-radius:14px;padding:16px;margin-bottom:14px';
const HEADING = 'font-family:var(--serif);font-size:15px;font-weight:700;margin:0 0 12px';

const STATUS_META = {
  PENDING: { label: 'Pending payment', color: 'var(--ink-mute)' },
  PAID: { label: 'Paid', color: 'var(--accent-2)' },
  FULFILLED: { label: 'Fulfilled', color: 'var(--accent-2)' },
  SHIPPED: { label: 'Shipped', color: 'var(--accent)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--accent-3)' },
  REFUNDED: { label: 'Refunded', color: 'var(--accent-3)' },
};

const money = (n) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n) || 0); }
  catch { return '$' + (Number(n) || 0).toFixed(2); }
};
const when = (ts) => {
  try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return ''; }
};

export default function AccountModal({ open, onClose }) {
  const [tab, setTab] = useState('profile');
  const [, force] = useState(0);
  const [orders, setOrders] = useState(null); // null = not loaded, [] = loaded empty
  const [downloads, setDownloads] = useState(null);
  const [busy, setBusy] = useState('');
  const [pwForm, setPwForm] = useState({ current: '', next: '' });
  const [emForm, setEmForm] = useState({ password: '', email: '' });
  const [delForm, setDelForm] = useState({ password: '', confirm: false });
  const [pwErr, setPwErr] = useState('');
  const [emErr, setEmErr] = useState('');
  const [delErr, setDelErr] = useState('');

  useEffect(() => account.subscribe(() => force((n) => n + 1)), []);

  useEffect(() => {
    if (!open) return;
    setTab('profile');
    setOrders(null);
    setDownloads(null);
    setPwForm({ current: '', next: '' });
    setEmForm({ password: '', email: '' });
    setDelForm({ password: '', confirm: false });
    setPwErr(''); setEmErr(''); setDelErr('');
    const lastFocus = document.activeElement; // restore focus to the trigger on close
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && tab === 'orders' && orders === null) {
      let alive = true;
      account.orders().then((list) => { if (alive) setOrders(list); });
      return () => { alive = false; };
    }
  }, [open, tab, orders]);

  useEffect(() => {
    if (open && tab === 'downloads' && downloads === null) {
      let alive = true;
      account.downloads().then((list) => { if (alive) setDownloads(list); });
      return () => { alive = false; };
    }
  }, [open, tab, downloads]);

  if (!open) return null;
  const user = account.current();
  if (!user) {
    // Not signed in: bounce to the sign-in modal.
    if (typeof window !== 'undefined') window.location.hash = '#signin';
    return null;
  }

  const initial = (user.name.trim()[0] || 'C').toUpperCase();

  const resend = async () => {
    setBusy('resend');
    const r = await account.resendVerification();
    setBusy('');
    if (r.ok) toast.success('Confirmation email sent. Check your inbox.');
    else toast.error(r.error || 'Could not send the email.');
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (busy) return;
    setPwErr('');
    setBusy('pw');
    const r = await account.changePassword(pwForm.current, pwForm.next);
    setBusy('');
    if (!r.ok) { setPwErr(r.error || 'Could not change your password.'); return; }
    setPwForm({ current: '', next: '' });
    toast.success('Your password has been changed.');
  };

  const changeEmail = async (e) => {
    e.preventDefault();
    if (busy) return;
    setEmErr('');
    setBusy('em');
    const r = await account.changeEmail(emForm.password, emForm.email);
    setBusy('');
    if (!r.ok) { setEmErr(r.error || 'Could not change your email.'); return; }
    setEmForm({ password: '', email: '' });
    toast.success('Email updated. Please confirm your new address.');
  };

  const signOutEverywhere = async () => {
    setBusy('all');
    const r = await account.logoutEverywhere();
    setBusy('');
    if (r.ok) toast.success('Signed out of your other sessions.');
    else toast.error(r.error || 'Could not sign out other sessions.');
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (busy) return;
    setDelErr('');
    if (!delForm.confirm) { setDelErr('Please tick the box to confirm.'); return; }
    setBusy('del');
    const r = await account.deleteAccount(delForm.password);
    setBusy('');
    if (!r.ok) { setDelErr(r.error || 'Could not delete your account.'); return; }
    toast.success('Your account has been deleted.');
    onClose();
  };

  const tabBtn = (id, text) => (
    <button
      type="button" onClick={() => setTab(id)}
      style={css('flex:1;border:none;border-radius:99px;padding:9px;font:700 12.5px/1 var(--sans);cursor:pointer;transition:.2s;' + (tab === id ? 'background:var(--accent);color:var(--accent-ink)' : 'background:transparent;color:var(--ink-soft)'))}
    >{text}</button>
  );

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Your account"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position:fixed;inset:0;z-index:8400;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:22px;overflow:auto')}
    >
      <div style={css('width:min(540px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line-soft)')}>
          <div style={css('display:flex;align-items:center;gap:10px')}>
            <Svg as="span" style={{ display: 'inline-grid', color: 'var(--accent)' }} html={icon('heart', 18, 1.8)} />
            <div style={css('font-family:var(--serif);font-size:19px;font-weight:700')}>Your account</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 16, 2)} />
          </button>
        </div>

        <div style={css('padding:18px 22px 24px;max-height:min(76vh,720px);overflow:auto')}>
          <div style={css('display:flex;gap:6px;background:var(--bg-1);border:1px solid var(--line);border-radius:99px;padding:4px;margin-bottom:20px')}>
            {tabBtn('profile', 'Profile')}
            {tabBtn('orders', 'Orders')}
            {tabBtn('downloads', 'Downloads')}
            {tabBtn('security', 'Security')}
          </div>

          {tab === 'profile' ? (
            <div>
              <div style={css('display:flex;align-items:center;gap:14px;margin-bottom:18px')}>
                <div style={css('width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 32% 28%,var(--raised),var(--panel-2));border:1px solid var(--line);font-family:var(--serif);font-weight:700;font-size:22px;color:var(--accent)')}>{initial}</div>
                <div>
                  <div style={css('font-family:var(--serif);font-size:20px;font-weight:700')}>{user.name}</div>
                  <div style={css('font-family:var(--mono);font-size:12px;color:var(--ink-mute)')}>{user.email}</div>
                </div>
              </div>

              <div style={css(SECTION)}>
                {user.verified ? (
                  <div style={css('display:flex;align-items:center;gap:8px;color:var(--accent-2);font:600 13px/1 var(--sans)')}>
                    <Svg as="span" style={{ display: 'inline-grid' }} html={icon('check', 15, 2.2)} /> Email confirmed
                  </div>
                ) : (
                  <div>
                    <div style={css('display:flex;align-items:center;gap:8px;color:var(--accent-3);font:600 13px/1.4 var(--sans);margin-bottom:10px')}>
                      <Svg as="span" style={{ display: 'inline-grid' }} html={icon('mail', 15, 1.8)} /> Your email is not confirmed yet.
                    </div>
                    <button type="button" onClick={resend} disabled={busy === 'resend'} style={css(BTN + ';' + GHOST + (busy === 'resend' ? ';opacity:.6;cursor:default' : ''))}>
                      {busy === 'resend' ? 'Sending...' : 'Resend confirmation email'}
                    </button>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => { account.signOut(); onClose(); }} style={css(BTN + ';' + GHOST + ';width:100%')}>Sign out</button>
            </div>
          ) : null}

          {tab === 'orders' ? (
            <div>
              {orders === null ? (
                <div style={css('text-align:center;color:var(--ink-mute);font-family:var(--mono);font-size:12.5px;padding:30px 0')}>Loading your orders...</div>
              ) : orders.length === 0 ? (
                <div style={css('text-align:center;color:var(--ink-soft);padding:30px 16px')}>
                  <div style={css('color:var(--accent);display:grid;place-items:center;margin-bottom:10px')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('bag', 26, 1.6)} /></div>
                  <div style={css('font-family:var(--serif);font-size:17px;font-weight:700;margin-bottom:4px')}>No orders yet</div>
                  <div style={css('font-size:13.5px')}>When you check out, your orders will appear here.</div>
                </div>
              ) : (
                <div style={css('display:flex;flex-direction:column;gap:12px')}>
                  {orders.map((o) => (
                    <div key={o.id} style={css(SECTION + ';margin-bottom:0')}>
                      <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px')}>
                        <div style={css('display:flex;align-items:center;gap:9px;flex-wrap:wrap')}>
                          <span style={css('font-family:var(--mono);font-size:11.5px;color:var(--ink-mute)')}>{when(o.createdAt)}</span>
                          {(() => { const s = STATUS_META[o.status] || { label: o.status || 'Placed', color: 'var(--ink-mute)' }; return (
                            <span style={css('display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:' + s.color)}>
                              <span style={css('width:6px;height:6px;border-radius:50%;background:' + s.color)} />{s.label}
                            </span>
                          ); })()}
                        </div>
                        <div style={css('font-family:var(--serif);font-size:17px;font-weight:700;color:var(--accent)')}>{money(o.total)}</div>
                      </div>
                      <div style={css('display:flex;flex-direction:column;gap:4px')}>
                        {(o.items || []).map((it, i) => (
                          <div key={i} style={css('display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--ink-soft)')}>
                            <span style={css('color:var(--ink)')}>{it.title}</span>
                            <span style={css('font-family:var(--mono);font-size:12px;color:var(--ink-mute)')}>x{it.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'downloads' ? (
            <div>
              {downloads === null ? (
                <div style={css('text-align:center;color:var(--ink-mute);font-family:var(--mono);font-size:12.5px;padding:30px 0')}>Loading your downloads...</div>
              ) : downloads.length === 0 ? (
                <div style={css('text-align:center;color:var(--ink-soft);padding:30px 16px')}>
                  <div style={css('color:var(--accent);display:grid;place-items:center;margin-bottom:10px')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('gift', 26, 1.6)} /></div>
                  <div style={css('font-family:var(--serif);font-size:17px;font-weight:700;margin-bottom:4px')}>No downloads yet</div>
                  <div style={css('font-size:13.5px')}>Books that include a free digital copy will appear here after you buy them.</div>
                </div>
              ) : (
                <div style={css('display:flex;flex-direction:column;gap:12px')}>
                  {downloads.map((d) => (
                    <div key={d.id} style={css(SECTION + ';margin-bottom:0;display:flex;align-items:center;gap:12px')}>
                      <span style={css('color:var(--accent);display:grid;flex-shrink:0')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('gift', 18, 1.7)} /></span>
                      <div style={css('min-width:0;flex:1')}>
                        <div style={css('font-family:var(--serif);font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{d.title}</div>
                        <div style={css('font-family:var(--mono);font-size:11px;color:var(--ink-mute)')}>{(d.formats || []).join(', ') || 'ebook'}{d.expiresAt ? ' . until ' + when(d.expiresAt) : ''}</div>
                      </div>
                      <a href={d.url} target="_blank" rel="noopener" style={css(BTN + ';padding:9px 16px;text-decoration:none;flex-shrink:0')}>Download</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'security' ? (
            <div>
              <form onSubmit={changePassword} style={css(SECTION)}>
                <h3 style={css(HEADING)}>Change password</h3>
                <div style={css('margin-bottom:10px')}>
                  <label style={css(LABEL)} htmlFor="ac-cur">Current password</label>
                  <input id="ac-cur" type="password" autoComplete="current-password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} style={css(FIELD)} />
                </div>
                <div>
                  <label style={css(LABEL)} htmlFor="ac-new">New password</label>
                  <input id="ac-new" type="password" autoComplete="new-password" value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} style={css(FIELD)} placeholder="at least 8 characters" />
                </div>
                {pwErr ? <div role="alert" style={css('color:var(--accent-3);font-family:var(--mono);font-size:12px;margin-top:9px')}>{pwErr}</div> : null}
                <button type="submit" disabled={busy === 'pw'} style={css(BTN + ';margin-top:14px' + (busy === 'pw' ? ';opacity:.6;cursor:default' : ''))}>{busy === 'pw' ? 'Saving...' : 'Update password'}</button>
              </form>

              <form onSubmit={changeEmail} style={css(SECTION)}>
                <h3 style={css(HEADING)}>Change email</h3>
                <div style={css('margin-bottom:10px')}>
                  <label style={css(LABEL)} htmlFor="ac-em">New email</label>
                  <input id="ac-em" type="email" autoComplete="email" value={emForm.email} onChange={(e) => setEmForm((f) => ({ ...f, email: e.target.value }))} style={css(FIELD)} placeholder="you@example.com" />
                </div>
                <div>
                  <label style={css(LABEL)} htmlFor="ac-empw">Confirm with your password</label>
                  <input id="ac-empw" type="password" autoComplete="current-password" value={emForm.password} onChange={(e) => setEmForm((f) => ({ ...f, password: e.target.value }))} style={css(FIELD)} />
                </div>
                {emErr ? <div role="alert" style={css('color:var(--accent-3);font-family:var(--mono);font-size:12px;margin-top:9px')}>{emErr}</div> : null}
                <button type="submit" disabled={busy === 'em'} style={css(BTN + ';margin-top:14px' + (busy === 'em' ? ';opacity:.6;cursor:default' : ''))}>{busy === 'em' ? 'Saving...' : 'Update email'}</button>
              </form>

              <div style={css(SECTION)}>
                <h3 style={css(HEADING)}>Sessions</h3>
                <p style={css('color:var(--ink-soft);font-size:13px;line-height:1.5;margin:0 0 12px')}>Signs you out on every other device, keeping this one.</p>
                <button type="button" onClick={signOutEverywhere} disabled={busy === 'all'} style={css(BTN + ';' + GHOST + (busy === 'all' ? ';opacity:.6;cursor:default' : ''))}>{busy === 'all' ? 'Working...' : 'Sign out everywhere else'}</button>
              </div>

              <form onSubmit={deleteAccount} style={css(SECTION + ';border-color:color-mix(in srgb,var(--accent-3) 40%,var(--line-soft))')}>
                <h3 style={css(HEADING + ';color:var(--accent-3)')}>Delete account</h3>
                <p style={css('color:var(--ink-soft);font-size:13px;line-height:1.5;margin:0 0 12px')}>Permanently removes your account, wishlist, reservations, and saved details. This cannot be undone.</p>
                <div style={css('margin-bottom:10px')}>
                  <label style={css(LABEL)} htmlFor="ac-del">Confirm with your password</label>
                  <input id="ac-del" type="password" autoComplete="current-password" value={delForm.password} onChange={(e) => setDelForm((f) => ({ ...f, password: e.target.value }))} style={css(FIELD)} />
                </div>
                <label style={css('display:flex;align-items:flex-start;gap:9px;font-size:13px;color:var(--ink-soft);cursor:pointer;line-height:1.4')}>
                  <input type="checkbox" checked={delForm.confirm} onChange={(e) => setDelForm((f) => ({ ...f, confirm: e.target.checked }))} style={css('margin-top:2px')} />
                  I understand this permanently deletes my account.
                </label>
                {delErr ? <div role="alert" style={css('color:var(--accent-3);font-family:var(--mono);font-size:12px;margin-top:9px')}>{delErr}</div> : null}
                <button type="submit" disabled={busy === 'del'} style={css(BTN + ';margin-top:14px;background:var(--accent-3);color:#fff' + (busy === 'del' ? ';opacity:.6;cursor:default' : ''))}>{busy === 'del' ? 'Deleting...' : 'Delete my account'}</button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
