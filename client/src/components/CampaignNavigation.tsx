import React from 'react';
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
  return (
    <>
      <aside
        id="campaign-sidebar"
        className={`sidebar${isOpen ? ' open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="sidebar-header">All Campaigns</div>
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
