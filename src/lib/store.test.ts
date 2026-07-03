import { describe, it, expect } from 'vitest';
import { createStore } from './store';

describe('store', () => {
  it('adds items and accumulates quantity', () => {
    const s = createStore();
    s.addToCart('b1', 'Salt House', '$18');
    s.addToCart('b1', 'Salt House', '$18');
    expect(s.cartCount()).toBe(2);
    expect(s.cartLines()).toHaveLength(1);
  });

  it('keeps two books with the same title as separate lines (keyed by id)', () => {
    const s = createStore();
    s.addToCart('b1', 'Same Title', '$18');
    s.addToCart('b2', 'Same Title', '$20');
    expect(s.cartLines()).toHaveLength(2);
  });

  it('computes the cart total from prices', () => {
    const s = createStore();
    s.addToCart('a', 'A', '$18', 2);
    s.addToCart('b', 'B', '$26');
    expect(s.cartTotal()).toBe(62);
  });

  it('removes a line when quantity drops to zero', () => {
    const s = createStore();
    s.addToCart('a', 'A', '$10', 1);
    s.setQty('a', 0);
    expect(s.cartCount()).toBe(0);
    expect(s.cartLines()).toHaveLength(0);
  });

  it('toggles wishlist membership', () => {
    const s = createStore();
    expect(s.toggleWish('A')).toBe(true);
    expect(s.inWishlist('A')).toBe(true);
    expect(s.toggleWish('A')).toBe(false);
    expect(s.wishCount()).toBe(0);
  });

  it('hydrates from a server payload and notifies subscribers', () => {
    const s = createStore();
    let calls = 0;
    s.subscribe(() => {
      calls += 1;
    });
    s.addToCart('a', 'A', '$10');
    expect(calls).toBe(1);
    s.hydrate([{ title: 'B', price: '$12', qty: 3 }], ['W']);
    expect(s.cartCount()).toBe(3);
    expect(s.inWishlist('W')).toBe(true);
    expect(calls).toBe(2);
  });
});
