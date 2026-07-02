import { arrivals } from './data.js';
import type { Book } from './types';

/* Tag the display catalog with genre / mood / pace / ending so search and the
   quiz recommender have something to reason about. Keyed by title so the
   presentation data in data.js stays lean. */
const TAGS: Record<string, Partial<Book>> = {
  'The Lantern Orchard': { genre: 'Fiction', mood: ['cozy', 'thoughtful'], pace: 'slow', ending: 'hopeful', pages: 328, year: 2021, reviews: 1284, summary: 'On the night the orchard lights its thousand lanterns, a grieving daughter returns to the family grove and learns that some debts are paid in fruit and in forgiveness.' },
  'Sugar & Smoke': { genre: 'Mystery', mood: ['heart-racing'], pace: 'fast', ending: 'bittersweet', pages: 296, year: 2023, reviews: 842, summary: 'A pastry chef with a ruined reputation is pulled into the death of a rival baker, and every clue tastes faintly of caramel and of revenge.' },
  'A Year of Small Rains': { genre: 'Nonfiction', mood: ['thoughtful', 'cozy'], pace: 'slow', ending: 'hopeful', pages: 244, year: 2020, reviews: 1976, summary: 'Twelve essays, one for each month, on weather, patience, and the quiet art of paying close attention to an ordinary life.' },
  'The Quiet Between Stars': { genre: 'Fantasy', mood: ['melancholy', 'thoughtful'], pace: 'medium', ending: 'open', pages: 412, year: 2022, reviews: 1530, summary: 'Two cartographers map a dying constellation and discover that the silence between the stars has been keeping a secret for a very long time.' },
  'Salt House': { genre: 'Fiction', mood: ['melancholy'], pace: 'slow', ending: 'bittersweet', pages: 268, year: 2019, reviews: 654, summary: 'A family returns to a crumbling house by the sea to settle an estate, and the tide keeps returning the things they meant to leave buried.' },
  "Le Jardin d'Hiver": { genre: 'Romance', mood: ['cozy', 'hopeful'], pace: 'medium', ending: 'hopeful', pages: 352, year: 2021, reviews: 1120, summary: 'In a frost-bound winter garden, two strangers agree to meet once a week until spring, and neither one expects the thaw to reach quite so far.' },
  'Tea for the Wandering': { genre: 'Fantasy', mood: ['whimsical', 'cozy'], pace: 'medium', ending: 'open', pages: 380, year: 2023, reviews: 990, summary: 'A traveling tea seller crosses seven kingdoms with a kettle that never empties and a map that keeps redrawing itself toward home.' },
  '\u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u062E\u0631\u064A\u0641': { genre: 'Poetry', mood: ['melancholy', 'hopeful'], pace: 'slow', ending: 'bittersweet', pages: 176, year: 2018, reviews: 1340, summary: 'A slim collection of autumn poems about memory, exile, and the amber light that falls only in the last weeks before the cold.' },
};

/* The bundled catalog mirrors the server seed (same titles, same order), so we
   assign the same stable ids (seed-1..seed-N). That way book detail links work
   even before the first /books fetch resolves, or if the API is unreachable. */
export const catalog: Book[] = arrivals.map((b, i) => ({
  ...b,
  id: 'seed-' + (i + 1),
  roast: b.roast as Book['roast'],
  ...(TAGS[b.title] || {}),
}));

export const genres: string[] = Array.from(
  new Set(catalog.map((b) => b.genre).filter((g): g is string => Boolean(g)))
);

export interface SearchFilters {
  query?: string;
  genre?: string;
  roast?: string;
  lang?: string;
  maxPrice?: number;
}

export function priceNum(price: string): number {
  return Number(price.replace(/[^0-9.]/g, '')) || 0;
}

export function searchCatalog(filters: SearchFilters = {}): Book[] {
  const q = (filters.query || '').trim().toLowerCase();
  return catalog.filter((b) => {
    if (q) {
      const hay = `${b.title} ${b.author} ${b.notes} ${b.genre || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.genre && b.genre !== filters.genre) return false;
    if (filters.roast && b.roast !== filters.roast) return false;
    if (filters.lang && (b.lang || 'English') !== filters.lang) return false;
    if (filters.maxPrice != null && priceNum(b.price) > filters.maxPrice) return false;
    return true;
  });
}
