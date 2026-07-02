/* Event reservations, backed by the server. The going list is cached so the UI
   can read it synchronously; toggling updates the cache optimistically and then
   reconciles with the API. init() loads your reservations on boot. */

import { api } from './api';

type Listener = () => void;

function createRsvp() {
  let going: string[] = [];
  let seq = 0;
  const listeners = new Set<Listener>();
  const emit = (): void => {
    listeners.forEach((l) => l());
  };

  return {
    list: (): string[] => going,
    isGoing: (id: string): boolean => going.includes(id),
    count: (): number => going.length,
    /* Seed reservations from a bootstrap payload (no extra request). */
    hydrate(list: string[]): void {
      seq += 1;
      going = Array.isArray(list) ? list : [];
      emit();
    },
    async init(): Promise<void> {
      try {
        const r = await api.get('/rsvps');
        seq += 1;
        going = Array.isArray(r.rsvps) ? r.rsvps : [];
        emit();
      } catch {
        /* offline: keep current list */
      }
    },
    toggle(id: string): boolean {
      const has = going.includes(id);
      going = has ? going.filter((g) => g !== id) : [...going, id];
      emit();
      const s = (seq += 1);
      api
        .post('/rsvps', { eventId: id })
        .then((r) => {
          if (s === seq && Array.isArray(r.rsvps)) {
            going = r.rsvps;
            emit();
          }
        })
        .catch(() => {});
      return !has;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const rsvp = createRsvp();
export type RsvpStore = ReturnType<typeof createRsvp>;
