import { useEffect } from 'react';

/** Closes the active drawer/overlay on Escape, matching the prototype's keyboard behaviour. */
export function useEscapeToClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);
}
