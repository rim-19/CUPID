import type { CartLine, StoreState } from './types';
import { api } from './api';
import { toast } from './toast';

const errMsg = (e: any, fallback: string): string => (e && e.data && e.data.error) || fallback;

type Listener = (state: StoreState) => void;

function priceNum(price: string): number {
  return Number(price.replace(/[^0-9.]/g, '')) || 0;
}

/* Pure in-memory cart + wishlist engine. Holds no opinion about persistence,
   so it is trivially testable and is reused as the local cache underneath the
   server-synced singleton below. */
export function createStore() {
  let state: StoreState = { cart: [], wishlist: [] };
  const listeners = new Set<Listener>();
  const emit = (): void => {
    listeners.forEach((l) => l(state));
  };

  return {
    get: (): StoreState => state,
    /* Replace cart and/or wishlist wholesale (used to sync from the server). */
    hydrate(cart?: CartLine[], wishlist?: string[]): void {
      if (cart) state = { ...state, cart };
      if (wishlist) state = { ...state, wishlist };
      emit();
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    addToCart(title: string, price: string, qty = 1): void {
      const line = state.cart.find((c) => c.title === title);
      if (line) {
        state.cart = state.cart.map((c) => (c.title === title ? { ...c, qty: c.qty + qty } : c));
      } else {
        state.cart = [...state.cart, { title, price, qty }];
      }
      emit();
    },
    setQty(title: string, qty: number): void {
      state.cart = state.cart
        .map((c) => (c.title === title ? { ...c, qty } : c))
        .filter((c) => c.qty > 0);
      emit();
    },
    removeFromCart(title: string): void {
      state.cart = state.cart.filter((c) => c.title !== title);
      emit();
    },
    clearCart(): void {
      state.cart = [];
      emit();
    },
    toggleWish(title: string): boolean {
      const has = state.wishlist.includes(title);
      state.wishlist = has
        ? state.wishlist.filter((t) => t !== title)
        : [...state.wishlist, title];
      emit();
      return !has;
    },
    inWishlist: (title: string): boolean => state.wishlist.includes(title),
    cartLines: (): CartLine[] => state.cart,
    cartCount: (): number => state.cart.reduce((n, c) => n + c.qty, 0),
    wishCount: (): number => state.wishlist.length,
    cartTotal: (): number => state.cart.reduce((n, c) => n + priceNum(c.price) * c.qty, 0),
  };
}

export type Store = ReturnType<typeof createStore>;

/* The shared instance the app uses. Reads come straight from the in-memory
   cache (so the imperative runtime and React stay in sync with no awaits);
   writes update the cache optimistically and then reconcile against the server,
   which is the source of truth. init() loads the signed-in (or guest) cart and
   wishlist on boot. If the API is unreachable it simply stays in-memory. */
function createServerStore() {
  const local = createStore();
  /* Per-resource write sequence: a server reply is applied only if it is the
     response to the most recent write, so out-of-order replies from rapid
     clicks can never clobber newer optimistic state. */
  let cartSeq = 0;
  let wishSeq = 0;
  const applyCart = (seq: number) => (r: { cart?: unknown }) => {
    if (seq === cartSeq && r && Array.isArray(r.cart)) local.hydrate(r.cart as never);
  };
  const applyWish = (seq: number) => (r: { wishlist?: unknown }) => {
    if (seq === wishSeq && r && Array.isArray(r.wishlist)) local.hydrate(undefined, r.wishlist as never);
  };

  /* The +/- stepper can fire many times in a second. The local cart updates on
     every click (instant UI), but the server PATCH is debounced per title so a
     burst collapses into one request. An immediate add / remove / checkout for
     a title cancels its pending qty write so it can never overwrite them. */
  const qtyTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const cancelQty = (title: string): void => {
    const t = qtyTimers.get(title);
    if (t) {
      clearTimeout(t);
      qtyTimers.delete(title);
    }
  };
  const cancelAllQty = (): void => {
    qtyTimers.forEach((t) => clearTimeout(t));
    qtyTimers.clear();
  };

  return {
    ...local,
    async init(): Promise<void> {
      try {
        const [c, w] = await Promise.all([api.get('/cart'), api.get('/wishlist')]);
        cartSeq += 1;
        wishSeq += 1;
        local.hydrate(c.cart || [], w.wishlist || []);
      } catch {
        /* offline / no backend: keep the in-memory cart */
      }
    },
    /* Seed cart + wishlist from a bootstrap payload (one request on load). */
    hydrate(cart?: CartLine[], wishlist?: string[]): void {
      cartSeq += 1;
      wishSeq += 1;
      local.hydrate(cart, wishlist);
    },
    addToCart(title: string, price: string, qty = 1): void {
      cancelQty(title);
      local.addToCart(title, price, qty);
      const seq = (cartSeq += 1);
      api.post('/cart', { title, price, qty }).then(applyCart(seq)).catch((e) => {
        toast.error(errMsg(e, 'Could not add that to your bag.'));
        const s = (cartSeq += 1);
        api.get('/cart').then(applyCart(s)).catch(() => {}); // roll back the optimistic add
      });
    },
    setQty(title: string, qty: number): void {
      local.setQty(title, qty);
      cancelQty(title);
      const t = setTimeout(() => {
        qtyTimers.delete(title);
        const seq = (cartSeq += 1);
        api.patch('/cart', { title, qty }).then(applyCart(seq)).catch(() => {});
      }, 250);
      qtyTimers.set(title, t);
    },
    removeFromCart(title: string): void {
      cancelQty(title);
      local.removeFromCart(title);
      const seq = (cartSeq += 1);
      api.del('/cart/' + encodeURIComponent(title)).then(applyCart(seq)).catch(() => {});
    },
    /* Start checkout. Returns a Stripe hosted-checkout URL to redirect to when
       payments are configured (the cart is kept until payment is confirmed), or
       an instant { order, downloads } result when Stripe is off (dev). The local
       cart is only cleared on the instant path; the Stripe path clears it after
       /checkout/confirm succeeds. */
    async checkout(): Promise<{ url?: string; order?: unknown; downloads?: Array<{ title: string; url: string }> }> {
      try {
        const r = await api.post('/cart/checkout');
        if (r && r.url) return { url: r.url };
        cancelAllQty();
        local.clearCart();
        cartSeq += 1;
        return { order: r && r.order, downloads: (r && r.downloads) || [] };
      } catch (e) {
        toast.error(errMsg(e, 'Checkout could not be completed.'));
        return {};
      }
    },
    toggleWish(title: string): boolean {
      const added = local.toggleWish(title);
      const seq = (wishSeq += 1);
      api.post('/wishlist', { title }).then(applyWish(seq)).catch((e) => {
        toast.error(errMsg(e, 'Could not update your wishlist.'));
        const s = (wishSeq += 1);
        api.get('/wishlist').then(applyWish(s)).catch(() => {});
      });
      return added;
    },
  };
}

export const store = createServerStore();
