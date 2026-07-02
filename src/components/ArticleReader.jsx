import React, { useEffect } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';
import { articles, articleById } from '../lib/articles.js';

export default function ArticleReader({ open, id, onClose }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  // jump to top whenever the article changes
  useEffect(() => { if (open) { const el = document.getElementById('reader-scroll'); if (el) el.scrollTop = 0; } }, [open, id]);

  if (!open) return null;

  const a = articleById(id);
  const idx = articles.findIndex((x) => x.id === String(id));
  const prevA = idx > 0 ? articles[idx - 1] : null;
  const nextA = idx >= 0 && idx < articles.length - 1 ? articles[idx + 1] : null;

  const back = (
    <button type="button" onClick={onClose} style={css('display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid var(--line);color:var(--ink-soft);border-radius:99px;padding:9px 16px;font:600 13px/1 var(--sans);cursor:pointer;transition:.2s')}>
      <span style={css('display:inline-grid;transform:rotate(180deg)')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('arrowR', 15, 1.9)} /></span> All notes
    </button>
  );

  return (
    <div id="reader-scroll" style={css('position:fixed;inset:0;z-index:8000;background:var(--bg);color:var(--ink);overflow:auto;animation:libIn .32s var(--ease)')}>
      <div style={css('position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line-soft)')}>
        <div style={css('max-width:760px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px')}>
          {back}
          <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 18, 2)} />
          </button>
        </div>
      </div>

      {!a ? (
        <div style={css('max-width:760px;margin:0 auto;padding:120px 24px;text-align:center;color:var(--ink-mute)')}>
          <div style={css('font-family:var(--serif);font-size:26px;color:var(--ink-soft);margin-bottom:14px')}>We could not find that note.</div>
          <button type="button" onClick={onClose} style={css('padding:11px 20px;border-radius:99px;background:var(--accent);color:var(--accent-ink);border:none;font-weight:700;font-size:13.5px;cursor:pointer')}>Back to the blog</button>
        </div>
      ) : (
        <article style={css('max-width:760px;margin:0 auto;padding:30px 24px 80px')}>
          <div style={css('display:flex;gap:9px;align-items:center;font-family:var(--mono);font-size:11.5px;color:var(--ink-mute);font-weight:500;letter-spacing:.05em;margin-bottom:16px')}>
            <span style={css('color:var(--accent);font-weight:600;text-transform:uppercase')}>{a.cat}</span>
            <span style={css('opacity:.5')}>/</span>{a.date}
            <span style={css('opacity:.5')}>/</span>{a.read}
          </div>
          <h1 style={css('font-family:var(--serif);font-weight:700;font-size:clamp(30px,5vw,46px);line-height:1.08;letter-spacing:-.02em;margin:0 0 26px')}>{a.title}</h1>
          <div style={css('height:220px;border-radius:18px;background:' + a.tint + ';display:grid;place-items:center;position:relative;overflow:hidden;color:rgba(255,255,255,.92);margin-bottom:32px')}>
            <div style={css('position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.10),transparent 62%)')} />
            <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 14px,transparent 14px 28px)')} />
            <span style={css('position:relative;opacity:.94')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon(a.icon, 56, 1.3)} /></span>
          </div>
          {a.body.map((p, i) => (
            <p key={i} style={css('font-size:17.5px;line-height:1.78;color:var(--ink-soft);margin:0 0 22px;font-family:var(--sans)')}>{p}</p>
          ))}

          <div style={css('display:flex;justify-content:space-between;gap:14px;margin-top:42px;padding-top:26px;border-top:1px solid var(--line-soft)')}>
            {prevA ? (
              <a href={'#post/' + prevA.id} style={css('text-decoration:none;color:var(--ink-soft);max-width:46%')}>
                <div style={css('font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:5px')}>Previous</div>
                <div style={css('font-family:var(--serif);font-size:16px;font-weight:700;color:var(--ink);line-height:1.25')}>{prevA.title}</div>
              </a>
            ) : <span />}
            {nextA ? (
              <a href={'#post/' + nextA.id} style={css('text-decoration:none;color:var(--ink-soft);max-width:46%;text-align:right;margin-left:auto')}>
                <div style={css('font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:5px')}>Next</div>
                <div style={css('font-family:var(--serif);font-size:16px;font-weight:700;color:var(--ink);line-height:1.25')}>{nextA.title}</div>
              </a>
            ) : <span />}
          </div>
        </article>
      )}
    </div>
  );
}
