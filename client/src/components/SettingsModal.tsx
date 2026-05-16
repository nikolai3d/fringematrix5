import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

// =============================================================================
// Focus Management Contract (SettingsModal):
// 1. When modal opens, the trigger element is stored by the caller on
//    `settingsTriggerRef` (in App.tsx) so focus can be restored on close.
// 2. Focus moves to the close button when modal opens.
// 3. Focus is trapped within the modal:
//    - Tab on last focusable element wraps to first
//    - Shift+Tab on first focusable element wraps to last
//    - Other keys are not intercepted
// 4. Escape key closes the modal.
// 5. When modal closes, the caller restores focus via the stored trigger.
// =============================================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isReduceMotion: boolean;
  isReduceEffects: boolean;
  onToggleReduceMotion: () => void;
  onToggleReduceEffects: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  isReduceMotion,
  isReduceEffects,
  onToggleReduceMotion,
  onToggleReduceEffects,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus Contract Item 3 & 4: trap Tab and handle Escape via shared hook
  useFocusTrap(isOpen, modalRef, onClose);

  // Focus Contract Item 2: focus the close button on open
  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="content-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal={true}
      aria-labelledby="settings-title"
    >
      <div className="content-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="content-modal-header">
          <span className="content-modal-title" id="settings-title">Settings</span>
          <button
            className="content-modal-close"
            ref={closeRef}
            aria-label="Close settings"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="content-modal-body settings-body">
          <h3 style={{ marginTop: 0 }}>Accessibility</h3>
          <div className="settings-row">
            <div className="settings-label">
              <span className="settings-label-text" id="settings-reduce-motion-label">Reduce Motion</span>
              <span className="settings-label-desc">Disable animations and transitions</span>
            </div>
            <button
              className={`settings-toggle${isReduceMotion ? ' active' : ''}`}
              role="switch"
              aria-checked={isReduceMotion}
              aria-labelledby="settings-reduce-motion-label"
              onClick={onToggleReduceMotion}
            >
              <span className="settings-toggle-knob"></span>
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-label">
              <span className="settings-label-text" id="settings-reduce-effects-label">Reduce Effects</span>
              <span className="settings-label-desc">Minimize glow, scanlines, and visual effects</span>
            </div>
            <button
              className={`settings-toggle${isReduceEffects ? ' active' : ''}`}
              role="switch"
              aria-checked={isReduceEffects}
              aria-labelledby="settings-reduce-effects-label"
              onClick={onToggleReduceEffects}
            >
              <span className="settings-toggle-knob"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
