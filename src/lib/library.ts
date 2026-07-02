import { catalog } from './catalog';
import { api } from './api';
import type { Book } from './types';

/* The library is the full browsable shelf: the built-in catalog plus any books
   an admin adds. The server is the source of truth; the in-memory cache below
   is seeded with the bundled catalog so the shelf renders instantly before the
   first fetch resolves (and so the pure factory stays unit-testable). */

type Listener = () => void;

/* Build a tasteful two-stop cover gradient from a single base colour so an
   admin only has to pick one colour to get a cover that matches the shelf. */
export function coverFromColor(hex: string): string {
  const raw = (hex || '#5a3a28').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const safe = [r, g, b].map((v) => (Number.isFinite(v) ? v : 90));
  const dark = safe.map((v) => Math.max(0, Math.round(v * 0.42)).toString(16).padStart(2, '0')).join('');
  return `linear-gradient(160deg,#${full},#${dark})`;
}

/* Pure in-memory shelf, seeded with the bundled catalog. Reused as the cache
   under the server-backed singleton, and exercised directly by unit tests. */
export function createLibraryStore() {
  let books: Book[] = [...catalog];
  const listeners = new Set<Listener>();
  const emit = (): void => {
    listeners.forEach((l) => l());
  };

  return {
    getBooks: (): Book[] => books,
    getCustom: (): Book[] => books.filter((b) => (b as Book & { custom?: boolean }).custom === true),
    hydrate(next: Book[]): void {
      books = Array.isArray(next) ? next : [];
      emit();
    },
    addBook(book: Book): void {
      const b = { ...book, custom: true };
      books = [b, ...books.filter((x) => x.title !== b.title)];
      emit();
    },
    removeCustom(idOrTitle: string): void {
      books = books.filter((b) => (b as Book & { id?: string }).id !== idOrTitle && b.title !== idOrTitle);
      emit();
    },
    genres(): string[] {
      const all = books.map((b) => b.genre).filter((g): g is string => Boolean(g));
      return Array.from(new Set(all));
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;

export interface AddBookResult {
  ok: boolean;
  error?: string;
}

/* The shared instance the app uses: reads hit the cache synchronously, while
   loading and admin mutations go through the API (which enforces that only an
   authenticated admin can add or remove books). */
function createServerLibrary() {
  const local = createLibraryStore();
  return {
    ...local,
    async init(): Promise<void> {
      try {
        const r = await api.get('/books');
        if (r && Array.isArray(r.books)) local.hydrate(r.books);
      } catch {
        /* offline: keep the seeded catalog */
      }
    },
    async addBook(book: Book): Promise<AddBookResult> {
      try {
        await api.post('/books', book);
        const r = await api.get('/books');
        if (r && Array.isArray(r.books)) local.hydrate(r.books);
        return { ok: true };
      } catch (e) {
        const err = e as { data?: { error?: string } };
        return { ok: false, error: (err && err.data && err.data.error) || 'Could not add the book.' };
      }
    },
    async removeCustom(idOrTitle: string): Promise<void> {
      try {
        await api.del('/books/' + encodeURIComponent(idOrTitle));
        const r = await api.get('/books');
        if (r && Array.isArray(r.books)) local.hydrate(r.books);
      } catch {
        /* ignore */
      }
    },
  };
}

export const library = createServerLibrary();
export type Library = typeof library;
