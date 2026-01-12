import { LOADING_SCREEN_TYPE } from '../config/loadingScreen';
import LegacyLoadingScreen from './LegacyLoadingScreen';
import TerminalLoadingScreen from './TerminalLoadingScreen';
import GlyphsLoadingScreen from './GlyphsLoadingScreen';

interface LoadingScreenProps {
  campaignCount: number | null;
  imageCount: number | null;
  isDataReady: boolean;
  onComplete: () => void;
}

/**
 * Loading Screen Wrapper
 * Selects and renders the appropriate loading screen based on configuration
 */
export default function LoadingScreen(props: LoadingScreenProps) {
  switch (LOADING_SCREEN_TYPE) {
    case 'legacy':
      return <LegacyLoadingScreen {...props} />;
    case 'glyphs':
      return <GlyphsLoadingScreen {...props} />;
    case 'terminal':
    default:
      return <TerminalLoadingScreen {...props} />;
  }
}
