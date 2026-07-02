import { describe, it, expect, beforeEach } from 'vitest';
import { createLibraryStore, coverFromColor } from './library';
import { catalog } from './catalog';
import type { Book } from './types';

const sample: Book = {
  title: 'Test Brew',
  author: 'A. Tester',
  rating: '4.5',
  price: '$20',
  tint: coverFromColor('#334455'),
  lang: '',
  roast: 'Med',
  notes: 'pear, smoke',
  genre: 'TestGenre',
  mood: ['cozy'],
  pace: 'slow',
  ending: 'open',
};

describe('coverFromColor', () => {
  it('builds a two-stop gradient from a hex', () => {
    const g = coverFromColor('#b8855a');
    expect(g).toContain('linear-gradient(160deg');
    expect(g.toLowerCase()).toContain('#b8855a');
  });

  it('falls back gracefully on empty input', () => {
    expect(coverFromColor('')).toContain('linear-gradient');
  });
});

describe('library store', () => {
  let lib: ReturnType<typeof createLibraryStore>;
  beforeEach(() => {
    lib = createLibraryStore();
  });

  it('starts from the built-in catalog', () => {
    expect(lib.getBooks().length).toBe(catalog.length);
    expect(lib.getCustom().length).toBe(0);
  });

  it('adds a book to the front, marks it custom, and surfaces its genre', () => {
    lib.addBook(sample);
    expect(lib.getBooks()[0].title).toBe('Test Brew');
    expect(lib.getBooks().length).toBe(catalog.length + 1);
    expect(lib.getCustom().map((b) => b.title)).toContain('Test Brew');
    expect(lib.genres()).toContain('TestGenre');
  });

  it('dedupes by title, keeping the latest', () => {
    lib.addBook({ ...sample, title: 'Dup', price: '$1' });
    lib.addBook({ ...sample, title: 'Dup', price: '$2' });
    const dups = lib.getBooks().filter((b) => b.title === 'Dup');
    expect(dups.length).toBe(1);
    expect(dups[0].price).toBe('$2');
  });

  it('removes a custom book by title', () => {
    lib.addBook({ ...sample, title: 'Bye' });
    expect(lib.getBooks().some((b) => b.title === 'Bye')).toBe(true);
    lib.removeCustom('Bye');
    expect(lib.getBooks().some((b) => b.title === 'Bye')).toBe(false);
  });

  it('hydrates wholesale from a server payload', () => {
    lib.hydrate([{ ...sample, title: 'Only One' }]);
    expect(lib.getBooks().length).toBe(1);
    expect(lib.getBooks()[0].title).toBe('Only One');
  });

  it('notifies subscribers when a book is added', () => {
    let hits = 0;
    const off = lib.subscribe(() => { hits += 1; });
    lib.addBook({ ...sample, title: 'Notify Me' });
    off();
    expect(hits).toBe(1);
  });
});
