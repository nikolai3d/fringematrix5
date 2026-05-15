import LoadingScreen from './LoadingScreen';

interface Props {
  show: boolean;
  loadingError: boolean;
  campaignCount: number | null;
  imageCount: number | null;
  isDataReady: boolean;
  onComplete: () => void;
}

export default function LoadingManager({
  show,
  loadingError,
  campaignCount,
  imageCount,
  isDataReady,
  onComplete,
}: Props) {
  if (loadingError) {
    return (
      <div className="crt-overlay" role="alertdialog" aria-modal={true} aria-label="Loading failed">
        <div className="crt-inner">
          <div className="crt-text">
            Fringe Matrix loading failed, check your Internet connection or try reloading the site
          </div>
        </div>
      </div>
    );
  }
  if (!show) return null;
  return (
    <LoadingScreen
      campaignCount={campaignCount}
      imageCount={imageCount}
      isDataReady={isDataReady}
      onComplete={onComplete}
    />
  );
}
