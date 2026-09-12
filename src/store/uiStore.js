import { create } from 'zustand';

let toastSeq = 0;

/** Minimal UI store — the admin only needs toast notifications, unlike the customer site's uiStore. */
export const useUiStore = create((set) => ({
  toasts: [],

  pushToast: (toast) => {
    const id = ++toastSeq;
    set((state) => ({ toasts: [...state.toasts, { id, kind: 'ok', ...toast }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3600);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
