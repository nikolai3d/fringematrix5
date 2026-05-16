/**
 * Closes all non-lightbox subwindow state by calling each setter with its
 * closed value.  The lightbox has its own animated close path (`closeLightbox`)
 * and is intentionally handled by the caller.
 *
 * Extracting this into a pure utility function lets us:
 *  - test it directly without rendering App
 *  - guarantee that every new subwindow is added in one place
 */

import type { ContentPage } from '../types/api';

export interface SubwindowSetters {
  setIsSidebarOpen: (open: boolean) => void;
  setIsBuildInfoOpen: (open: boolean) => void;
  setIsShareOpen: (open: boolean) => void;
  setActiveModal: (modal: ContentPage | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

export function closeSubwindowsState(setters: SubwindowSetters): void {
  setters.setIsSidebarOpen(false);
  setters.setIsBuildInfoOpen(false);
  setters.setIsShareOpen(false);
  setters.setActiveModal(null);
  setters.setIsSettingsOpen(false);
}
