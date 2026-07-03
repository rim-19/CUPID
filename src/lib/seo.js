/* Per-book page metadata: title, description, Open Graph, and schema.org
   JSON-LD, updated when a book detail opens and restored when it closes.

   NOTE: this runs client-side, so it improves the browser tab, shareable
   links, and JS-aware tools. Search-engine/social crawlers that do not execute
   JavaScript still need server-side rendering per product URL (a build-level
   follow-up) to see this content. */

const DEFAULT_TITLE = typeof document !== 'undefined' ? document.title : 'Cupid';
const DEFAULT_DESC = 'Cupid - a cozy coffee house and bookshop. Find your next love story, over coffee.';

function upsertMeta(keyAttr, keyVal, content) {
  let el = document.head.querySelector(`meta[${keyAttr}="${keyVal}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(keyAttr, keyVal);
    el.setAttribute('data-dynamic', 'book');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

export function setBookMeta(book) {
  if (typeof document === 'undefined' || !book) return;
  const desc = clip(book.summary || book.notes || `${book.title} by ${book.author}`, 160);
  document.title = `${book.title} by ${book.author} — Cupid`;
  upsertMeta('name', 'description', desc);
  upsertMeta('property', 'og:title', `${book.title} by ${book.author}`);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:type', 'book');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    bookFormat: 'https://schema.org/Paperback',
    inLanguage: book.lang || 'English',
    numberOfPages: book.pages || undefined,
    offers: {
      '@type': 'Offer',
      price: (Number(String(book.price).replace(/[^0-9.]/g, '')) || 0).toFixed(2),
      priceCurrency: 'USD',
      availability: (book.stock === 0) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };
  if (Number(book.reviews) > 0) {
    ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(book.rating), reviewCount: Number(book.reviews) };
  }
  let script = document.getElementById('book-jsonld');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'book-jsonld';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(ld);
}

export function clearBookMeta() {
  if (typeof document === 'undefined') return;
  document.title = DEFAULT_TITLE;
  document.head.querySelectorAll('meta[data-dynamic="book"]').forEach((el) => el.remove());
  upsertMeta('name', 'description', DEFAULT_DESC);
  const script = document.getElementById('book-jsonld');
  if (script) script.remove();
}
