import { describe, it, expect } from 'vitest';
import { searchCatalog, catalog, genres, priceNum } from './catalog';
import { recommend } from './recommend';

describe('catalog search', () => {
  it('has an enriched, tagged catalog', () => {
    expect(catalog.length).toBeGreaterThan(0);
    expect(genres.length).toBeGreaterThan(1);
  });

  it('filters by free-text query across title/author/notes', () => {
    const res = searchCatalog({ query: 'lantern' });
    expect(res.some((b) => b.title.includes('Lantern'))).toBe(true);
  });

  it('filters by roast and price ceiling', () => {
    const dark = searchCatalog({ roast: 'Dark' });
    expect(dark.every((b) => b.roast === 'Dark')).toBe(true);
    const cheap = searchCatalog({ maxPrice: 20 });
    expect(cheap.every((b) => priceNum(b.price) <= 20)).toBe(true);
  });

  it('returns everything for an empty filter', () => {
    expect(searchCatalog({}).length).toBe(catalog.length);
  });
});

describe('quiz recommender', () => {
  it('returns the requested number of books', () => {
    expect(recommend({ mood: 'cozy', pace: 'slow', ending: 'hopeful' }, 3)).toHaveLength(3);
  });

  it('ranks a book matching all three answers near the top', () => {
    const res = recommend({ mood: 'cozy', pace: 'slow', ending: 'hopeful' }, 3);
    expect(res[0].mood).toContain('cozy');
  });

  it('responds to different answers with different ordering', () => {
    const a = recommend({ mood: 'heart-racing', pace: 'fast', ending: 'bittersweet' }, 1);
    const b = recommend({ mood: 'cozy', pace: 'slow', ending: 'hopeful' }, 1);
    expect(a[0].title).not.toBe(b[0].title);
  });
});
