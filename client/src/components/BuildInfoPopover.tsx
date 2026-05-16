import React from 'react';
import { formatTimePacific } from '../utils/formatTimePacific';
import { gitRemoteToHttps } from '../utils/gitRemoteToHttps';
import type { BuildInfo } from '../types/api';

interface BuildInfoPopoverProps {
  style: React.CSSProperties;
  buildInfo: BuildInfo | null;
  onClose: () => void;
}

export default function BuildInfoPopover({ style, buildInfo, onClose }: BuildInfoPopoverProps) {
  const repoHref = gitRemoteToHttps(buildInfo?.repoUrl || '');

  return (
    <div className="build-info-popover" role="dialog" aria-modal={false} style={style}>
      <div className="build-info-header">
        <span>Build Info</span>
        <button
          className="build-info-close"
          aria-label="Close build info"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="build-info-body">
        <div className="row">
          <span className="label">Repo</span>
          {repoHref ? (
            <a href={repoHref} target="_blank" rel="noreferrer noopener">{repoHref}</a>
          ) : (
            <span className="value">N/A</span>
          )}
        </div>
        <div className="row">
          <span className="label">Commit</span>
          {buildInfo?.commitHash ? (
            <span className="value monospace" title={buildInfo.commitHash}>{buildInfo.commitHash}</span>
          ) : (
            <span className="value">N/A</span>
          )}
        </div>
        <div className="row">
          <span className="label">Time of build:</span>
          <span className="value">{buildInfo?.builtAt ? formatTimePacific(buildInfo.builtAt) : 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}
