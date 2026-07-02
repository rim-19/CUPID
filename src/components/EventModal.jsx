import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { eventById } from '../lib/eventsData.js';
import { rsvp } from '../lib/rsvp';
import { account } from '../lib/account';

export default function EventModal({ open, id, onClose }) {
  const [, force] = useState(0);
  useEffect(() => rsvp.subscribe(() => force((n) => n + 1)), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const ev = eventById(id);
  const going = ev ? rsvp.isGoing(ev.id) : false;
  const user = account.current();

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Event"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={css('position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:22px;overflow:auto')}
    >
      <div style={css('width:min(540px,100%);background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.6);overflow:hidden;animation:adminIn .3s var(--ease)')}>
        <div style={css('display:flex;justify-content:flex-end;padding:14px 14px 0')}>
          <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 16, 2)} />
          </button>
        </div>

        {!ev ? (
          <div style={css('padding:20px 26px 40px;text-align:center;color:var(--ink-mute)')}>
            <div style={css('font-family:var(--serif);font-size:22px;color:var(--ink-soft);margin-bottom:14px')}>That event has wrapped up.</div>
            <button type="button" onClick={onClose} style={css('padding:11px 20px;border-radius:99px;background:var(--accent);color:var(--accent-ink);border:none;font-weight:700;font-size:13.5px;cursor:pointer')}>Back to events</button>
          </div>
        ) : (
          <div style={css('padding:6px 28px 30px')}>
            <div style={css('display:flex;gap:20px;align-items:center;margin-bottom:20px')}>
              <div style={css('flex-shrink:0;width:78px;height:88px;border-radius:14px;background:var(--bg);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px')}>
                <div style={css('font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)')}>{ev.month}</div>
                <div style={css('font-family:var(--serif);font-size:30px;font-weight:700;line-height:1')}>{ev.day}</div>
              </div>
              <div>
                <div style={css('display:inline-flex;align-items:center;gap:7px;padding:5px 12px 5px 9px;border-radius:99px;background:var(--bg);font-size:11.5px;font-weight:600;color:var(--ink-soft);margin-bottom:9px;font-family:var(--mono);letter-spacing:.03em')}>
                  <span style={css('color:var(--accent);display:grid')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon(ev.icon, 14, 1.7)} /></span>{ev.type}
                </div>
                <div style={css('font-family:var(--serif);font-size:23px;font-weight:700;line-height:1.15')}>{ev.title}</div>
              </div>
            </div>

            <div style={css('display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;font-family:var(--mono);font-size:12px;color:var(--ink-mute)')}>
              <span style={css('background:var(--bg-1);border:1px solid var(--line-soft);border-radius:99px;padding:6px 12px')}>{ev.time}</span>
              <span style={css('background:var(--bg-1);border:1px solid var(--line-soft);border-radius:99px;padding:6px 12px')}>{ev.place}</span>
              <span style={css('background:var(--bg-1);border:1px solid var(--line-soft);border-radius:99px;padding:6px 12px')}>{ev.spots}</span>
            </div>

            {ev.desc.map((p, i) => (
              <p key={i} style={css('font-size:15px;line-height:1.7;color:var(--ink-soft);margin:0 0 14px')}>{p}</p>
            ))}

            {going ? (
              <div role="status" style={css('display:flex;align-items:center;gap:10px;margin-top:20px;padding:14px 16px;border-radius:14px;background:var(--bg-1);border:1px solid var(--line)')}>
                <span style={css('display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--accent-2);color:var(--accent-ink);flex-shrink:0')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('check', 16, 2.4)} /></span>
                <div style={css('font-size:14px;color:var(--ink)')}>
                  <strong>You are going.</strong> {user ? 'A reminder will reach ' + user.email + '.' : 'Sign in to get a reminder.'}
                </div>
              </div>
            ) : null}

            <div style={css('display:flex;gap:10px;margin-top:20px')}>
              <button type="button" onClick={() => rsvp.toggle(ev.id)} style={css('flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:99px;padding:13px 20px;font:800 14px/1 var(--sans);cursor:pointer;transition:.2s;border:none;' + (going ? 'background:transparent;border:1px solid var(--line);color:var(--ink-soft)' : 'background:var(--accent);color:var(--accent-ink)'))}>
                {going ? 'Cancel reservation' : 'Reserve a spot'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
