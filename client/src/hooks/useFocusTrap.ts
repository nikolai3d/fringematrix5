import { useEffect } from 'react';
import { FOCUSABLE_SELECTOR } from '../utils/focusable';

/**
 * Traps keyboard focus inside `modalRef` while `active` is true.
 *
 * Behaviour:
 * - Escape key → calls `onClose`
 * - Tab on the last focusable element wraps to the first
 * - Shift+Tab on the first focusable element wraps to the last
 * - Cleans up the keydown listener on deactivation / unmount
 */
export function useFocusTrap(
  active: boolean,
  modalRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [active, modalRef, onClose]);
}
