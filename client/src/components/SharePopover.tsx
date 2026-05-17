import React from 'react';

interface SharePopoverProps {
  style: React.CSSProperties;
  threadsShareUrl: string;
  onClose: () => void;
}

export default function SharePopover({ style, threadsShareUrl, onClose }: SharePopoverProps) {
  return (
    <div className="share-popover" role="dialog" aria-label="Share" aria-modal={false} style={style}>
      <div className="share-header">
        <span>Share</span>
        <button
          className="share-close"
          aria-label="Close share"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="share-body">
        <a
          className="action-btn"
          href={threadsShareUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Share on Threads
        </a>
      </div>
    </div>
  );
}
