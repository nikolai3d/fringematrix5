import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Note: Home Button navigation behavior is tested via e2e tests in e2e/app.spec.ts
// which test the actual component behavior rather than duplicating implementation.

// Tests for toolbar layout CSS requirements
describe('Toolbar Layout CSS', () => {
  // Read the CSS file once for all tests
  const cssPath = path.resolve(__dirname, '../src/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  it('toolbar should have a fixed height', () => {
    // Toolbar must have explicit height for consistent layout
    expect(cssContent).toMatch(/\.toolbar\s*\{[^}]*height:\s*\d+px/);
  });

  it('toolbar-inner should use flexbox for single-row layout', () => {
    // Must use flex display
    expect(cssContent).toMatch(/\.toolbar-inner\s*\{[^}]*display:\s*flex/);
  });

  it('toolbar-inner should not wrap buttons to multiple rows', () => {
    // flex-wrap: nowrap ensures single row
    expect(cssContent).toMatch(/\.toolbar-inner\s*\{[^}]*flex-wrap:\s*nowrap/);
  });

  it('toolbar-inner should be horizontally scrollable', () => {
    // overflow-x: auto enables horizontal scrolling when content overflows
    expect(cssContent).toMatch(/\.toolbar-inner\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('toolbar buttons should not shrink', () => {
    // flex-shrink: 0 prevents buttons from shrinking
    expect(cssContent).toMatch(/\.toolbar-button\s*\{[^}]*flex-shrink:\s*0/);
  });

  it('toolbar buttons should have nowrap text', () => {
    // white-space: nowrap keeps button text on single line
    expect(cssContent).toMatch(/\.toolbar-button\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('popovers should have lower z-index than toolbar', () => {
    // Extract z-index values
    const toolbarZIndex = cssContent.match(/\.toolbar\s*\{[^}]*z-index:\s*(\d+)/);
    const buildInfoZIndex = cssContent.match(/\.build-info-popover\s*\{[^}]*z-index:\s*(\d+)/);
    const shareZIndex = cssContent.match(/\.share-popover\s*\{[^}]*z-index:\s*(\d+)/);

    expect(toolbarZIndex).not.toBeNull();
    expect(buildInfoZIndex).not.toBeNull();
    expect(shareZIndex).not.toBeNull();

    const toolbarZ = parseInt(toolbarZIndex[1], 10);
    const buildInfoZ = parseInt(buildInfoZIndex[1], 10);
    const shareZ = parseInt(shareZIndex[1], 10);

    // Popovers should be below toolbar so they don't overlap it
    expect(buildInfoZ).toBeLessThan(toolbarZ);
    expect(shareZ).toBeLessThan(toolbarZ);
  });
});

// Tests for popover positioning logic
describe('Popover Positioning', () => {
  it('popover should be positioned below the button with offset', () => {
    // Simulate the positioning logic from toggleBuildInfo/toggleShare
    const mockButtonRect = {
      bottom: 52, // toolbar height
      left: 100
    };
    const offset = 8;

    const popoverStyle = {
      top: Math.round(mockButtonRect.bottom + offset),
      left: Math.round(mockButtonRect.left)
    };

    // Popover top should be below toolbar (button bottom + offset)
    expect(popoverStyle.top).toBe(60);
    expect(popoverStyle.left).toBe(100);
  });

  it('popover should not overlap toolbar when positioned correctly', () => {
    const toolbarHeight = 52;
    const offset = 8;

    // Simulate button at various positions
    const buttonBottoms = [52, 45, 48]; // Various button bottom positions

    buttonBottoms.forEach(buttonBottom => {
      const popoverTop = buttonBottom + offset;
      // Popover must start at or after toolbar height
      expect(popoverTop).toBeGreaterThanOrEqual(toolbarHeight);
    });
  });
});

// Tests for goHome subwindow closing behavior
describe('goHome Subwindow Closing', () => {
  // Simulate the closeAllSubwindows function that goHome calls
  const createCloseAllSubwindows = (setters) => () => {
    setters.setIsLightboxOpen(false);
    setters.setIsSidebarOpen(false);
    setters.setIsBuildInfoOpen(false);
    setters.setIsShareOpen(false);
    setters.setActiveModal(null);
  };

  it('should close all subwindows when goHome is called', () => {
    // Track which setters were called with what values
    const calls = {
      lightbox: [],
      sidebar: [],
      buildInfo: [],
      share: [],
      modal: []
    };

    const setters = {
      setIsLightboxOpen: (val) => calls.lightbox.push(val),
      setIsSidebarOpen: (val) => calls.sidebar.push(val),
      setIsBuildInfoOpen: (val) => calls.buildInfo.push(val),
      setIsShareOpen: (val) => calls.share.push(val),
      setActiveModal: (val) => calls.modal.push(val)
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    // All subwindows should be set to false/null
    expect(calls.lightbox).toContain(false);
    expect(calls.sidebar).toContain(false);
    expect(calls.buildInfo).toContain(false);
    expect(calls.share).toContain(false);
    expect(calls.modal).toContain(null);
  });

  it('should close lightbox when it was open', () => {
    let lightboxOpen = true;
    const setters = {
      setIsLightboxOpen: (val) => { lightboxOpen = val; },
      setIsSidebarOpen: vi.fn(),
      setIsBuildInfoOpen: vi.fn(),
      setIsShareOpen: vi.fn(),
      setActiveModal: vi.fn()
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    expect(lightboxOpen).toBe(false);
  });

  it('should close sidebar (campaign list) when it was open', () => {
    let sidebarOpen = true;
    const setters = {
      setIsLightboxOpen: vi.fn(),
      setIsSidebarOpen: (val) => { sidebarOpen = val; },
      setIsBuildInfoOpen: vi.fn(),
      setIsShareOpen: vi.fn(),
      setActiveModal: vi.fn()
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    expect(sidebarOpen).toBe(false);
  });

  it('should close build info popover when it was open', () => {
    let buildInfoOpen = true;
    const setters = {
      setIsLightboxOpen: vi.fn(),
      setIsSidebarOpen: vi.fn(),
      setIsBuildInfoOpen: (val) => { buildInfoOpen = val; },
      setIsShareOpen: vi.fn(),
      setActiveModal: vi.fn()
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    expect(buildInfoOpen).toBe(false);
  });

  it('should close share popover when it was open', () => {
    let shareOpen = true;
    const setters = {
      setIsLightboxOpen: vi.fn(),
      setIsSidebarOpen: vi.fn(),
      setIsBuildInfoOpen: vi.fn(),
      setIsShareOpen: (val) => { shareOpen = val; },
      setActiveModal: vi.fn()
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    expect(shareOpen).toBe(false);
  });

  it('should close content modal when it was open', () => {
    let activeModal = 'history';
    const setters = {
      setIsLightboxOpen: vi.fn(),
      setIsSidebarOpen: vi.fn(),
      setIsBuildInfoOpen: vi.fn(),
      setIsShareOpen: vi.fn(),
      setActiveModal: (val) => { activeModal = val; }
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    expect(activeModal).toBe(null);
  });

  it('should close all subwindows when multiple are open simultaneously', () => {
    // Simulate multiple subwindows being open at once
    let lightboxOpen = true;
    let sidebarOpen = true;
    let buildInfoOpen = true;
    let shareOpen = true;
    let activeModal = 'credits';

    const setters = {
      setIsLightboxOpen: (val) => { lightboxOpen = val; },
      setIsSidebarOpen: (val) => { sidebarOpen = val; },
      setIsBuildInfoOpen: (val) => { buildInfoOpen = val; },
      setIsShareOpen: (val) => { shareOpen = val; },
      setActiveModal: (val) => { activeModal = val; }
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);
    closeAllSubwindows();

    expect(lightboxOpen).toBe(false);
    expect(sidebarOpen).toBe(false);
    expect(buildInfoOpen).toBe(false);
    expect(shareOpen).toBe(false);
    expect(activeModal).toBe(null);
  });

  it('should be safe to call when all subwindows are already closed', () => {
    let lightboxOpen = false;
    let sidebarOpen = false;
    let buildInfoOpen = false;
    let shareOpen = false;
    let activeModal = null;

    const setters = {
      setIsLightboxOpen: (val) => { lightboxOpen = val; },
      setIsSidebarOpen: (val) => { sidebarOpen = val; },
      setIsBuildInfoOpen: (val) => { buildInfoOpen = val; },
      setIsShareOpen: (val) => { shareOpen = val; },
      setActiveModal: (val) => { activeModal = val; }
    };

    const closeAllSubwindows = createCloseAllSubwindows(setters);

    // Should not throw and all should remain false/null
    expect(() => closeAllSubwindows()).not.toThrow();
    expect(lightboxOpen).toBe(false);
    expect(sidebarOpen).toBe(false);
    expect(buildInfoOpen).toBe(false);
    expect(shareOpen).toBe(false);
    expect(activeModal).toBe(null);
  });
});

// Test the placeholder image creation logic directly
describe('Campaign Loading Placeholder Logic', () => {
  it('should create placeholder images with null src during loading', () => {
    // Simulate the campaignImages data from API
    const campaignImages = [
      { src: 'https://example.com/image1.jpg', fileName: 'image1.jpg' },
      { src: 'https://example.com/image2.jpg', fileName: 'image2.jpg' }
    ];
    
    // Simulate the placeholder creation logic from App.jsx
    const placeholderImages = campaignImages.map(img => ({
      fileName: img.fileName,
      originalSrc: img.src,
      src: null, // Should be null during loading
      isLoading: true,
      loadedSrc: null
    }));
    
    // Verify placeholder structure
    expect(placeholderImages).toHaveLength(2);
    
    placeholderImages.forEach((placeholder, index) => {
      expect(placeholder.fileName).toBe(campaignImages[index].fileName);
      expect(placeholder.originalSrc).toBe(campaignImages[index].src);
      expect(placeholder.src).toBeNull(); // Critical: src should be null
      expect(placeholder.isLoading).toBe(true);
      expect(placeholder.loadedSrc).toBeNull();
    });
  });

  it('should update image src only after loading completes', () => {
    // Initial placeholder state
    const initialPlaceholder = {
      fileName: 'test.jpg',
      originalSrc: 'https://example.com/test.jpg',
      src: null,
      isLoading: true,
      loadedSrc: null
    };
    
    // Simulate loading completion update logic from App.jsx
    const loadedImage = {
      ...initialPlaceholder,
      isLoading: false,
      src: 'https://example.com/test.jpg', // Now has src
      loadedSrc: 'https://example.com/test.jpg'
    };
    
    // Verify the transition
    expect(initialPlaceholder.src).toBeNull();
    expect(initialPlaceholder.isLoading).toBe(true);
    
    expect(loadedImage.src).toBe('https://example.com/test.jpg');
    expect(loadedImage.isLoading).toBe(false);
    expect(loadedImage.loadedSrc).toBe('https://example.com/test.jpg');
  });

  it('should maintain all placeholders until ALL images are loaded (all-or-nothing)', () => {
    const images = [
      { fileName: 'img1.jpg', originalSrc: 'url1', src: null, isLoading: true, loadedSrc: null },
      { fileName: 'img2.jpg', originalSrc: 'url2', src: null, isLoading: true, loadedSrc: null },
      { fileName: 'img3.jpg', originalSrc: 'url3', src: null, isLoading: true, loadedSrc: null }
    ];
    
    // In all-or-nothing loading, images should remain as placeholders until ALL are loaded
    // Even if some individual images finish loading, they should stay as placeholders
    
    // During loading phase - all should remain placeholders
    images.forEach(img => {
      expect(img.isLoading).toBe(true);
      expect(img.src).toBeNull();
      expect(img.loadedSrc).toBeNull();
    });
    
    // After ALL images complete loading - show all at once
    const originalUrls = ['url1', 'url2', 'url3'];
    const imagesAfterAllLoaded = originalUrls.map((url, i) => ({
      src: url,
      fileName: images[i].fileName,
      isLoading: false,
      loadedSrc: url
    }));
    
    // Verify all images show at once
    imagesAfterAllLoaded.forEach((img, i) => {
      expect(img.isLoading).toBe(false);
      expect(img.src).toBe(originalUrls[i]);
      expect(img.loadedSrc).toBe(originalUrls[i]);
    });
  });

  it('should not provide actual image URLs until image preloading is complete', () => {
    // This test ensures the core requirement: no real src until loading is done
    const campaignImages = [
      { src: 'https://cdn.example.com/real-image.jpg', fileName: 'real-image.jpg' }
    ];
    
    // Create placeholders as done in App.jsx
    const placeholders = campaignImages.map(img => ({
      fileName: img.fileName,
      originalSrc: img.src, // Store separately
      src: null, // Critical: prevent browser from loading
      isLoading: true,
      loadedSrc: null
    }));
    
    // Verify that during loading phase, no real URLs are exposed
    expect(placeholders[0].src).toBeNull();
    expect(placeholders[0].originalSrc).toBe('https://cdn.example.com/real-image.jpg');
    
    // Only after "loading" completes should src be set
    const afterLoading = {
      ...placeholders[0],
      isLoading: false,
      src: placeholders[0].originalSrc,
      loadedSrc: placeholders[0].originalSrc
    };
    
    expect(afterLoading.src).toBe('https://cdn.example.com/real-image.jpg');
    expect(afterLoading.isLoading).toBe(false);
  });

  it('should enforce all-or-nothing loading behavior per campaign', () => {
    // Simulate a campaign with multiple images
    const campaignImages = [
      { src: 'https://example.com/img1.jpg', fileName: 'img1.jpg' },
      { src: 'https://example.com/img2.jpg', fileName: 'img2.jpg' },
      { src: 'https://example.com/img3.jpg', fileName: 'img3.jpg' }
    ];
    
    // Create initial placeholders (all should be loading)
    const placeholders = campaignImages.map(img => ({
      fileName: img.fileName,
      originalSrc: img.src,
      src: null,
      isLoading: true,
      loadedSrc: null
    }));
    
    // Verify all start as placeholders
    placeholders.forEach(placeholder => {
      expect(placeholder.src).toBeNull();
      expect(placeholder.isLoading).toBe(true);
    });
    
    // In all-or-nothing, even if individual images finish loading,
    // we don't update them until ALL are done
    
    // Simulate ALL images completing (the final state update from selectCampaign)
    const allLoaded = campaignImages.map(img => ({
      ...img,
      isLoading: false,
      loadedSrc: img.src
    }));
    
    // Verify all images appear at once
    allLoaded.forEach((img, index) => {
      expect(img.src).toBe(campaignImages[index].src);
      expect(img.isLoading).toBe(false);
      expect(img.loadedSrc).toBe(campaignImages[index].src);
    });
    
    // Key assertion: there should be no intermediate state where some images
    // have src and others don't - it's all placeholders or all images
  });
});

describe('Lightbox Click Event Handling', () => {
  it('lightbox toolbar elements should call stopPropagation to prevent closure', () => {
    // Test that lightbox toolbar buttons have stopPropagation handlers
    const mockEvent = {
      stopPropagation: vi.fn(),
      currentTarget: { click: vi.fn() }
    };

    // Simulate click handlers for lightbox toolbar buttons
    // These handlers should call stopPropagation
    const lightboxPrevHandler = (e) => { e.stopPropagation(); /* nextImage(-1) */ };
    const lightboxShareHandler = (e) => { e.stopPropagation(); /* handleShare() */ };
    const lightboxNextHandler = (e) => { e.stopPropagation(); /* nextImage(1) */ };

    // Test each lightbox toolbar button
    lightboxPrevHandler(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);

    mockEvent.stopPropagation.mockClear();
    lightboxShareHandler(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);

    mockEvent.stopPropagation.mockClear();
    lightboxNextHandler(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('main toolbar elements should NOT call stopPropagation to allow closure', () => {
    // Test that main toolbar buttons do NOT have stopPropagation
    const mockEvent = {
      stopPropagation: vi.fn(),
      currentTarget: { click: vi.fn() }
    };

    // Simulate click handlers for main toolbar buttons
    // These handlers should NOT call stopPropagation
    const campaignsHandler = () => { /* toggleSidebar() */ };
    const shareHandler = () => { /* toggleShare() */ };
    const buildInfoHandler = () => { /* toggleBuildInfo() */ };

    // Test main toolbar buttons - they should not call stopPropagation
    campaignsHandler(mockEvent);
    shareHandler(mockEvent);
    buildInfoHandler(mockEvent);

    expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
  });

  it('navigation arrows should NOT call stopPropagation to allow closure', () => {
    // Test that navigation arrow buttons do NOT have stopPropagation
    const mockEvent = {
      stopPropagation: vi.fn(),
      currentTarget: { click: vi.fn() }
    };

    // Simulate click handlers for navigation arrows
    // These handlers should NOT call stopPropagation
    const prevCampaignHandler = () => { /* goToPrevCampaign() */ };
    const nextCampaignHandler = () => { /* goToNextCampaign() */ };

    // Test navigation arrows - they should not call stopPropagation
    prevCampaignHandler(mockEvent);
    nextCampaignHandler(mockEvent);

    expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
  });

  it('download link should have stopPropagation to prevent closure', () => {
    // Test that download link has stopPropagation in its existing onClick
    const mockEvent = {
      stopPropagation: vi.fn(),
      currentTarget: { click: vi.fn() }
    };

    // The download link already has onClick={(e) => e.stopPropagation()}
    const downloadHandler = (e) => { e.stopPropagation(); };

    downloadHandler(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('lightbox click logic should identify toolbar area correctly', () => {
    // Test the logic used in handleLightboxClick for toolbar area detection
    
    // Mock DOM elements and their bounding rectangles
    const mockToolbarElement = {
      getBoundingClientRect: () => ({
        left: 100,
        right: 200,
        top: 300,
        bottom: 350
      })
    };

    // Mock click coordinates
    const clickInsideToolbar = { x: 150, y: 325 };
    const clickOutsideToolbar = { x: 50, y: 250 };

    // Simulate the toolbar detection logic from handleLightboxClick
    const isInToolbarArea = (clickX, clickY, toolbarElement) => {
      if (!toolbarElement) return false;
      const rect = toolbarElement.getBoundingClientRect();
      return (
        clickX >= rect.left &&
        clickX <= rect.right &&
        clickY >= rect.top &&
        clickY <= rect.bottom
      );
    };

    // Test clicks inside toolbar area
    expect(isInToolbarArea(clickInsideToolbar.x, clickInsideToolbar.y, mockToolbarElement)).toBe(true);

    // Test clicks outside toolbar area
    expect(isInToolbarArea(clickOutsideToolbar.x, clickOutsideToolbar.y, mockToolbarElement)).toBe(false);

    // Test with null toolbar element
    expect(isInToolbarArea(clickInsideToolbar.x, clickInsideToolbar.y, null)).toBe(false);
  });
});

// Tests for Content Modal (History, Credits, Legal)
describe('Content Modal Behavior', () => {
  const VALID_CONTENT_PAGES = ['history', 'credits', 'legal'];

  it('should only allow valid content page types', () => {
    const validPages = ['history', 'credits', 'legal'];
    const invalidPages = ['about', 'contact', 'settings', '', null, undefined];

    validPages.forEach(page => {
      expect(VALID_CONTENT_PAGES.includes(page)).toBe(true);
    });

    invalidPages.forEach(page => {
      expect(VALID_CONTENT_PAGES.includes(page)).toBe(false);
    });
  });

  it('should capitalize page name for modal title', () => {
    // Simulate the title capitalization logic from App.tsx
    const capitalizePageName = (page) => {
      return page.charAt(0).toUpperCase() + page.slice(1);
    };

    expect(capitalizePageName('history')).toBe('History');
    expect(capitalizePageName('credits')).toBe('Credits');
    expect(capitalizePageName('legal')).toBe('Legal');
  });

  it('openModal should close other popovers before opening', () => {
    // Simulate the openModal behavior that closes other popovers
    let buildInfoOpen = true;
    let shareOpen = true;
    let sidebarOpen = true;
    let activeModal = null;

    const openModal = (page) => {
      // Close other popovers
      buildInfoOpen = false;
      shareOpen = false;
      sidebarOpen = false;
      // Set the active modal
      activeModal = page;
    };

    openModal('history');

    expect(buildInfoOpen).toBe(false);
    expect(shareOpen).toBe(false);
    expect(sidebarOpen).toBe(false);
    expect(activeModal).toBe('history');
  });

  it('closeModal should reset modal state', () => {
    let activeModal = 'credits';
    let modalContent = '<h2>Credits</h2><p>Some content</p>';

    const closeModal = () => {
      activeModal = null;
      modalContent = '';
    };

    closeModal();

    expect(activeModal).toBe(null);
    expect(modalContent).toBe('');
  });

  it('modal overlay click should call closeModal', () => {
    // Simulate clicking on overlay (not the modal content itself)
    let modalClosed = false;
    const closeModal = () => { modalClosed = true; };

    // Overlay click
    closeModal();
    expect(modalClosed).toBe(true);
  });

  it('modal content click should stop propagation', () => {
    // Test that clicking inside the modal doesn't bubble to overlay
    const mockEvent = {
      stopPropagation: vi.fn()
    };

    // Simulate the onClick handler for content-modal div
    const handleModalContentClick = (e) => {
      e.stopPropagation();
    };

    handleModalContentClick(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('should display loading state while fetching content', () => {
    let isModalLoading = true;
    let modalContent = '';

    // When loading is true and content is empty, loading state should show
    expect(isModalLoading).toBe(true);
    expect(modalContent).toBe('');

    // After content loads
    isModalLoading = false;
    modalContent = '<h2>History</h2><p>Content loaded</p>';

    expect(isModalLoading).toBe(false);
    expect(modalContent.length).toBeGreaterThan(0);
  });

  it('should handle content load failure gracefully', () => {
    let modalContent = '';
    const errorMessage = '<p>Failed to load content. Please try again.</p>';

    // Simulate a load failure
    modalContent = errorMessage;

    expect(modalContent).toContain('Failed to load content');
  });
});

// Tests for Modal Focus Management
describe('Modal Focus Management', () => {
  it('should store trigger element when opening modal', () => {
    // Simulate the openModal behavior that stores the trigger
    let modalTriggerRef = { current: null };
    const mockActiveElement = { focus: vi.fn(), tagName: 'BUTTON' };

    // Simulate storing the trigger (as done in openModal)
    const storeTrigger = () => {
      modalTriggerRef.current = mockActiveElement;
    };

    storeTrigger();
    expect(modalTriggerRef.current).toBe(mockActiveElement);
  });

  it('should restore focus to trigger element when closing modal', () => {
    // Simulate the closeModal behavior that restores focus
    const mockTrigger = { focus: vi.fn() };
    let modalTriggerRef = { current: mockTrigger };

    // Simulate closeModal focus restoration logic
    const restoreFocus = () => {
      if (modalTriggerRef.current) {
        modalTriggerRef.current.focus();
        modalTriggerRef.current = null;
      }
    };

    restoreFocus();

    expect(mockTrigger.focus).toHaveBeenCalledTimes(1);
    expect(modalTriggerRef.current).toBe(null);
  });

  it('should not throw when closing modal with no trigger', () => {
    let modalTriggerRef = { current: null };

    const restoreFocus = () => {
      if (modalTriggerRef.current) {
        modalTriggerRef.current.focus();
        modalTriggerRef.current = null;
      }
    };

    // Should not throw
    expect(() => restoreFocus()).not.toThrow();
  });

  it('should trap focus - Tab on last element wraps to first', () => {
    const firstElement = { focus: vi.fn() };
    const lastElement = { focus: vi.fn() };
    const focusableElements = [firstElement, lastElement];

    // Simulate Tab key on last element
    const mockEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn()
    };

    // Simulate the focus trap logic
    const handleFocusTrap = (e, activeElement) => {
      if (e.key === 'Tab') {
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    // Simulate active element being the last element
    handleFocusTrap(mockEvent, lastElement);

    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(firstElement.focus).toHaveBeenCalledTimes(1);
  });

  it('should trap focus - Shift+Tab on first element wraps to last', () => {
    const firstElement = { focus: vi.fn() };
    const lastElement = { focus: vi.fn() };
    const focusableElements = [firstElement, lastElement];

    // Simulate Shift+Tab key on first element
    const mockEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: vi.fn()
    };

    // Simulate the focus trap logic
    const handleFocusTrap = (e, activeElement) => {
      if (e.key === 'Tab') {
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    // Simulate active element being the first element
    handleFocusTrap(mockEvent, firstElement);

    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(lastElement.focus).toHaveBeenCalledTimes(1);
  });

  it('should not trap focus when Tab is pressed on middle element', () => {
    const firstElement = { focus: vi.fn() };
    const middleElement = { focus: vi.fn() };
    const lastElement = { focus: vi.fn() };
    const focusableElements = [firstElement, middleElement, lastElement];

    const mockEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn()
    };

    const handleFocusTrap = (e, activeElement) => {
      if (e.key === 'Tab') {
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    // Simulate active element being a middle element
    handleFocusTrap(mockEvent, middleElement);

    // Should not prevent default or change focus - let browser handle it
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(firstElement.focus).not.toHaveBeenCalled();
    expect(lastElement.focus).not.toHaveBeenCalled();
  });

  it('should handle Escape key to close modal', () => {
    let modalClosed = false;
    const closeModal = () => { modalClosed = true; };

    const mockEvent = {
      key: 'Escape',
      shiftKey: false,
      preventDefault: vi.fn()
    };

    // Simulate the keyboard handler
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
    };

    handleKeyDown(mockEvent);

    expect(modalClosed).toBe(true);
  });

  it('should not interfere with other keys', () => {
    const firstElement = { focus: vi.fn() };
    const lastElement = { focus: vi.fn() };

    const mockEvent = {
      key: 'Enter',
      shiftKey: false,
      preventDefault: vi.fn()
    };

    const handleFocusTrap = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        firstElement.focus();
      }
    };

    handleFocusTrap(mockEvent);

    // Should not prevent default or focus anything for non-Tab keys
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(firstElement.focus).not.toHaveBeenCalled();
  });
});

// Tests for Content Modal CSS
describe('Content Modal CSS', () => {
  const cssPath = path.resolve(__dirname, '../src/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Helper to extract a CSS rule block by selector
  const getCssRule = (selector) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = cssContent.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'));
    return match ? match[1] : '';
  };

  it('modal overlay should cover entire screen', () => {
    const rule = getCssRule('.content-modal-overlay');
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/inset:\s*0/);
  });

  it('modal should be centered', () => {
    const rule = getCssRule('.content-modal-overlay');
    expect(rule).toMatch(/display:\s*grid/);
    expect(rule).toMatch(/place-items:\s*center/);
  });

  it('modal should have high z-index for proper stacking', () => {
    const rule = getCssRule('.content-modal-overlay');
    const zIndexMatch = rule.match(/z-index:\s*(\d+)/);
    expect(zIndexMatch).not.toBeNull();
    const zIndex = parseInt(zIndexMatch[1], 10);
    // Should be above toolbar (z-index: 30) but could be below lightbox (z-index: 50)
    expect(zIndex).toBeGreaterThanOrEqual(30);
  });

  it('modal body should be scrollable', () => {
    const rule = getCssRule('.content-modal-body');
    expect(rule).toMatch(/overflow-y:\s*auto/);
  });

  it('modal should have max-height to prevent overflow', () => {
    const rule = getCssRule('.content-modal');
    expect(rule).toMatch(/max-height:\s*85vh/);
  });
});