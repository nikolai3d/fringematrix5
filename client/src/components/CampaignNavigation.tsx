import React, { useEffect } from 'react';
import type { Campaign } from '../types/api';

interface Props {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  isOpen: boolean;
  isCampaignLoading: boolean;
  onSelect: (id: string) => void | Promise<void>;
  onClose: () => void;
}

function CampaignNavigation({
  campaigns,
  activeCampaignId,
  isOpen,
  isCampaignLoading,
  onSelect,
  onClose,
}: Props) {
  // Escape closes the drawer (it has no other keyboard exit).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <>
      <aside
        id="campaign-sidebar"
        className={`sidebar${isOpen ? ' open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="sidebar-header">
          <span>All Campaigns</span>
          {/* On phones the drawer covers most of the screen, leaving only a
              thin overlay strip to tap; give it an explicit close control. */}
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close campaigns"
            onClick={onClose}
            tabIndex={isOpen ? 0 : -1}
          >
            ✕
          </button>
        </div>
        <div className="sidebar-list">
          {campaigns.map((c) => (
            <button
              key={c.id}
              className={`sidebar-item${c.id === activeCampaignId ? ' active' : ''}`}
              onClick={async () => {
                await onSelect(c.id);
                onClose();
              }}
              disabled={isCampaignLoading}
              tabIndex={isOpen ? 0 : -1}
            >
              #{c.hashtag}
            </button>
          ))}
        </div>
      </aside>
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} aria-hidden={true}></div>
      )}
    </>
  );
}

export default React.memo(CampaignNavigation);
