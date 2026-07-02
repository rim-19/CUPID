import React, { useEffect, useState } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { toast } from '../lib/toast';

const KIND = {
  success: { color: 'var(--accent-2)', ic: 'check' },
  error: { color: 'var(--accent-3)', ic: 'close' },
  info: { color: 'var(--accent)', ic: 'sparkle' },
};

export default function Toaster() {
  const [, force] = useState(0);
  useEffect(() => toast.subscribe(() => force((n) => n + 1)), []);
  const items = toast.list();
  if (!items.length) return null;
  return (
    <div aria-live="polite" style={css('position:fixed;left:50%;transform:translateX(-50%);bottom:22px;z-index:9999;display:flex;flex-direction:column;gap:10px;width:min(420px,calc(100vw - 32px));pointer-events:none')}>
      {items.map((t) => {
        const k = KIND[t.kind] || KIND.info;
        return (
          <div
            key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            style={css('pointer-events:auto;display:flex;align-items:center;gap:11px;background:var(--panel);border:1px solid var(--line);border-left:3px solid ' + k.color + ';border-radius:12px;padding:13px 15px;box-shadow:0 18px 50px rgba(0,0,0,.5);animation:adminIn .25s var(--ease)')}
          >
            <span style={css('color:' + k.color + ';display:grid;flex-shrink:0')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon(k.ic, 16, 2)} /></span>
            <span style={css('font:500 13.5px/1.45 var(--sans);color:var(--ink)')}>{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => toast.dismiss(t.id)} style={css('margin-left:auto;flex-shrink:0;background:none;border:none;color:var(--ink-mute);cursor:pointer;display:grid;place-items:center')}>
              <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 14, 2)} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
