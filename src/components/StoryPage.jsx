import React, { useEffect } from 'react';
import { css } from '../lib/css.js';
import { icon, Svg } from '../lib/icons.jsx';

const STORY = [
  'We started in 2012 with one wobbly espresso machine and a single shelf of paperbacks, in a storefront that had been three failed businesses in a row. The landlord wished us luck in the tone of a man who had wished it before.',
  'The first winter was lean. We sold more coffee than books and gave away more advice than either. But people kept coming back for the same reason we had opened the doors: it is a good thing to have somewhere warm to sit with a story and a strong drink, and there were fewer such places than there should have been.',
  'Fourteen years later the shelves climb the walls, the back room hosts poetry by candlelight, and the espresso machine still hisses like it is in love. Every book here has been read, argued over, and lovingly hand-noted by one of our keepers, usually over a second cup.',
  'We are not the biggest bookshop in the city and we have never tried to be. We are the one where someone remembers what you read last time, hands you the next thing before you ask, and refuses to tell you how it ends.',
];

const KEEPERS = [
  { initial: 'W', name: 'Wren', role: 'Keeper of Fiction', quote: 'slow books for fast lives', bio: 'Wren can find the one novel on a wall of two thousand that will undo you in the best way. Ask for something quiet and you will leave with something that follows you home.' },
  { initial: 'B', name: 'Bram', role: 'Keeper of Mystery', quote: 'i hide the good clues', bio: 'Bram runs the blind-date table and the book club, and considers a spoiler a personal failing. He has read the ending of every mystery we stock and will take each one to his grave.' },
  { initial: 'R', name: 'Rowan', role: 'Keeper of the Roast', quote: 'every cup is a love letter', bio: 'Rowan keeps the machine hissing and the cocoa pot full. Tell Rowan what you are reading and you will get a drink that suits the chapter, whether you asked for one or not.' },
];

export default function StoryPage({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={css('position:fixed;inset:0;z-index:8000;background:var(--bg);color:var(--ink);overflow:auto;animation:libIn .32s var(--ease)')}>
      <div style={css('position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line-soft)')}>
        <div style={css('max-width:860px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px')}>
          <button type="button" onClick={onClose} style={css('display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid var(--line);color:var(--ink-soft);border-radius:99px;padding:9px 16px;font:600 13px/1 var(--sans);cursor:pointer')}>
            <span style={css('display:inline-grid;transform:rotate(180deg)')}><Svg as="span" style={{ display: 'inline-grid' }} html={icon('arrowR', 15, 1.9)} /></span> Back
          </button>
          <button type="button" aria-label="Close" onClick={onClose} style={css('display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-soft);cursor:pointer')}>
            <Svg as="span" style={{ display: 'inline-grid' }} html={icon('close', 18, 2)} />
          </button>
        </div>
      </div>

      <div style={css('max-width:760px;margin:0 auto;padding:36px 24px 90px')}>
        <div style={css('font-family:var(--mono);font-size:11.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:16px')}>Our story</div>
        <h1 style={css('font-family:var(--serif);font-weight:700;font-size:clamp(30px,5vw,50px);line-height:1.05;letter-spacing:-.02em;margin:0 0 30px')}>A little coffee house that fell hard for books.</h1>
        {STORY.map((p, i) => (
          <p key={i} style={css('font-size:17.5px;line-height:1.78;color:var(--ink-soft);margin:0 0 22px;font-family:var(--sans)')}>{p}</p>
        ))}

        <h2 style={css('font-family:var(--serif);font-weight:700;font-size:28px;letter-spacing:-.01em;margin:46px 0 20px')}>The keepers</h2>
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          {KEEPERS.map((k) => (
            <div key={k.name} style={css('display:flex;gap:18px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px 22px')}>
              <div style={css('width:62px;height:62px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 32% 28%,var(--raised),var(--panel-2));border:1px solid var(--line)')}>
                <span style={css('font-family:var(--serif);font-weight:600;font-size:26px;color:var(--accent)')}>{k.initial}</span>
                <span style={css('position:absolute;inset:4px;border-radius:50%;border:1px solid var(--line-soft)')} />
              </div>
              <div>
                <div style={css('font-family:var(--serif);font-size:20px;font-weight:700')}>{k.name}</div>
                <div style={css('font-family:var(--mono);font-size:11.5px;color:var(--ink-mute);font-weight:500;letter-spacing:.05em;margin:3px 0 8px;text-transform:uppercase')}>{k.role}</div>
                <div style={css('font-family:var(--hand);font-size:19px;color:var(--accent);line-height:1.1;margin-bottom:10px')}>&ldquo;{k.quote}&rdquo;</div>
                <p style={css('font-size:14.5px;line-height:1.65;color:var(--ink-soft);margin:0')}>{k.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
