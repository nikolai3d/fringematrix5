import { useEffect, useRef } from 'react';
import type { ContentPage } from '../types/api';
import { useFocusTrap } from '../hooks/useFocusTrap';

// =============================================================================
// Focus Management Contract (ContentModal):
// 1. When modal opens, the trigger element (set by the caller) is stored on
//    `triggerRef` so focus can be restored on close.
// 2. Focus moves to the close button when modal opens.
// 3. Focus is trapped within the modal:
//    - Tab on last focusable element wraps to first
//    - Shift+Tab on first focusable element wraps to last
//    - Other keys are not intercepted
// 4. Escape key closes the modal.
// 5. When modal closes, the caller restores focus via the stored trigger.
// 6. If no trigger element exists, focus restoration is safely skipped.
// =============================================================================

interface Props {
  activeModal: ContentPage | null;
  content: string;
  isLoading: boolean;
  onClose: () => void;
}

export default function ContentModal({ activeModal, content, isLoading, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus Contract Item 3 & 4: trap Tab and handle Escape via shared hook
  useFocusTrap(!!activeModal, modalRef, onClose);

  useEffect(() => {
    if (!activeModal) return;

    // Focus Contract Item 2: focus the close button on open
    const focusTimer = setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [activeModal]);

  if (!activeModal) return null;

  return (
    <div
      className="content-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal={true}
      aria-labelledby="modal-title"
    >
      <div className="content-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="content-modal-header">
          <span className="content-modal-title" id="modal-title">
            {activeModal.charAt(0).toUpperCase() + activeModal.slice(1)}
          </span>
          <button
            className="content-modal-close"
            ref={closeRef}
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="content-modal-body">
          {isLoading ? (
            <div className="content-modal-loading">Loading...</div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>
      </div>
    </div>
  );
}
