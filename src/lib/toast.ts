/* A tiny framework-agnostic notification store. The UI (Toaster.jsx)
   subscribes; any module can call toast.success / toast.error to surface a
   message, so API failures are no longer swallowed silently. */

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}
type Listener = () => void;

function createToaster() {
  let items: ToastItem[] = [];
  let seq = 1;
  const listeners = new Set<Listener>();
  const emit = (): void => {
    listeners.forEach((l) => l());
  };

  function dismiss(id: number): void {
    items = items.filter((t) => t.id !== id);
    emit();
  }

  function show(message: string, kind: ToastKind = 'info', ttl = 4500): number {
    const id = seq++;
    items = [...items, { id, message, kind }];
    emit();
    if (ttl > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => dismiss(id), ttl);
    }
    return id;
  }

  return {
    list: (): ToastItem[] => items,
    show,
    success: (m: string): number => show(m, 'success'),
    error: (m: string): number => show(m, 'error'),
    info: (m: string): number => show(m, 'info'),
    dismiss,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const toast = createToaster();
export type ToastStore = ReturnType<typeof createToaster>;
