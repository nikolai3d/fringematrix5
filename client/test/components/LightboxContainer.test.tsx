import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { useRef, useState } from 'react';
import LightboxContainer from '../../src/components/LightboxContainer';
import type { Campaign, ImageData } from '../../src/types/api';

/**
 * Behavioural tests for LightboxContainer in isolation (no App shell):
 * navigation + wrap-around, HUD / live region, outside-click close, animation
 * guard, touch swipe gestures, share, the mobile details drawer, and the
 * keyboard focus trap.
 */

// jsdom (v24) has no PointerEvent; fireEvent falls back to a plain Event and
// drops pointerType/clientX. Provide a minimal MouseEvent-based polyfill.
class TestPointerEvent extends MouseEvent {
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? '';
  }
}
let hadPointerEvent = false;
beforeAll(() => {
  hadPointerEvent = 'PointerEvent' in window;
  if (!hadPointerEvent) {
    (window as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;
  }
});
afterAll(() => {
  if (!hadPointerEvent) delete (window as unknown as { PointerEvent?: unknown }).PointerEvent;
});

function makeCampaign(id: string, episode: string): Campaign {
  return { id, hashtag: `tag${id}`, episode, episode_id: 'S01E01', date: '2012-01-01', icon_path: `${id}.png` };
}

const CAMPAIGN_A = makeCampaign('a', 'Episode A');
const CAMPAIGN_B = makeCampaign('b', 'Episode B');

const IMAGES: ImageData[] = [
  { fileName: 'one.jpg', src: '/avatars/one.jpg', campaignId: 'a' },
  { fileName: 'two.jpg', src: '/avatars/two.jpg', campaignId: 'b' },
  { fileName: 'three.jpg', src: '/avatars/three.jpg' },
];

interface HarnessProps {
  images?: ImageData[];
  initialIndex?: number;
  isLightboxOpen?: boolean;
  hideLightboxImage?: boolean;
  animating?: boolean;
  closeLightbox?: () => void;
  activeCampaign?: Campaign | null;
  campaigns?: Campaign[];
}

function Harness({
  images = IMAGES,
  initialIndex = 0,
  isLightboxOpen = true,
  hideLightboxImage = false,
  animating = false,
  closeLightbox = () => {},
  activeCampaign = CAMPAIGN_A,
  campaigns = [CAMPAIGN_A, CAMPAIGN_B],
}: HarnessProps) {
  const [idx, setIdx] = useState(initialIndex);
  const isAnimatingRef = useRef(animating);
  isAnimatingRef.current = animating;
  return (
    <>
      <button>gallery-behind</button>
      <LightboxContainer
        images={images}
        lightboxIndex={idx}
        isLightboxOpen={isLightboxOpen}
        hideLightboxImage={hideLightboxImage}
        activeCampaign={activeCampaign}
        campaigns={campaigns}
        setLightboxIndex={setIdx}
        closeLightbox={closeLightbox}
        isAnimatingRef={isAnimatingRef}
      />
    </>
  );
}

function renderLightbox(props: HarnessProps = {}) {
  const closeLightbox = props.closeLightbox ?? vi.fn();
  const utils = render(<Harness {...props} closeLightbox={closeLightbox} />);
  return { ...utils, closeLightbox };
}

const img = () => document.getElementById('lightbox-image') as HTMLImageElement;
const hud = () => document.querySelector('.lightbox-hud')!;
const lightbox = () => document.getElementById('lightbox')!;

let rafQueue: FrameRequestCallback[];
function flushRaf() {
  const q = rafQueue;
  rafQueue = [];
  act(() => q.forEach((cb) => cb(0)));
}

beforeEach(() => {
  rafQueue = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LightboxContainer — rendering', () => {
  it('renders nothing when closed', () => {
    renderLightbox({ isLightboxOpen: false });
    expect(document.getElementById('lightbox')).toBeNull();
  });

  it('renders a modal dialog with the current image', () => {
    renderLightbox({ initialIndex: 1 });
    const dialog = screen.getByRole('dialog', { name: 'Image viewer' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(img().getAttribute('src')).toBe('/avatars/two.jpg');
    expect(img()).toHaveStyle({ opacity: '1' });
  });

  it('hides the image (opacity 0) when hideLightboxImage is set', () => {
    renderLightbox({ hideLightboxImage: true });
    expect(img()).toHaveStyle({ opacity: '0' });
  });

  it('shows HUD text and a polite live region describing position', () => {
    renderLightbox({ initialIndex: 1 });
    expect(hud()).toHaveTextContent('FILE: two.jpg // 2 OF 3');
    expect(hud()).toHaveAttribute('aria-hidden', 'true');
    const live = document.querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('two.jpg, image 2 of 3');
  });

  it('renders an empty live region and "#" download href for an out-of-range index', () => {
    renderLightbox({ images: [], initialIndex: 0 });
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('');
    expect(hud()).toHaveTextContent('FILE: // 1 OF 0');
    expect(document.getElementById('download-btn')).toHaveAttribute('href', '#');
  });

  it('sets up the download link for the current image', () => {
    renderLightbox();
    const dl = document.getElementById('download-btn')!;
    expect(dl).toHaveAttribute('href', '/avatars/one.jpg');
    expect(dl).toHaveAttribute('download', 'one.jpg');
  });

  it('moves initial focus to the close button on the next frame', () => {
    renderLightbox();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).not.toBe(close);
    flushRaf();
    expect(document.activeElement).toBe(close);
  });

  it('resolves the details campaign per image with activeCampaign fallback', () => {
    renderLightbox({ activeCampaign: CAMPAIGN_A });
    const sidebar = () => document.querySelector('aside.lightbox-details')!;
    expect(sidebar()).toHaveTextContent('Episode A');
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(sidebar()).toHaveTextContent('Episode B');
    // image 3 has no campaignId → activeCampaign
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(sidebar()).toHaveTextContent('Episode A');
  });

  it('falls back to activeCampaign when the image campaignId is unknown', () => {
    renderLightbox({ images: [{ fileName: 'x', src: '/x', campaignId: 'zzz' }], activeCampaign: CAMPAIGN_B });
    expect(document.querySelector('aside.lightbox-details')).toHaveTextContent('Episode B');
  });
});

describe('LightboxContainer — navigation', () => {
  it('Next / Previous buttons move and wrap around', () => {
    const { closeLightbox } = renderLightbox();
    const next = screen.getByRole('button', { name: 'Next image' });
    const prev = screen.getByRole('button', { name: 'Previous image' });
    fireEvent.click(prev);
    expect(hud()).toHaveTextContent('3 OF 3');
    fireEvent.click(next);
    expect(hud()).toHaveTextContent('1 OF 3');
    fireEvent.click(next);
    expect(hud()).toHaveTextContent('2 OF 3');
    // nav clicks never bubble into outside-click close
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('ArrowRight / ArrowLeft navigate with wrap-around', () => {
    renderLightbox({ initialIndex: 2 });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(hud()).toHaveTextContent('1 OF 3');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(hud()).toHaveTextContent('3 OF 3');
  });

  it('keeps index 0 when navigating an empty list', () => {
    renderLightbox({ images: [] });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(hud()).toHaveTextContent('1 OF 0');
  });

  it('Escape closes the lightbox', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeLightbox).toHaveBeenCalledTimes(1);
  });

  it('close button closes the lightbox', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closeLightbox).toHaveBeenCalled();
  });

  it('does not listen for keys when closed', () => {
    const { closeLightbox } = renderLightbox({ isLightboxOpen: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('removes the key listener on unmount', () => {
    const { closeLightbox, unmount } = renderLightbox();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeLightbox).not.toHaveBeenCalled();
  });
});

describe('LightboxContainer — outside click', () => {
  it('closes when clicking the backdrop', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(lightbox());
    expect(closeLightbox).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking the stage outside the image', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(document.querySelector('.lightbox-stage')!);
    expect(closeLightbox).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['image', () => img()],
    ['toolbar', () => document.querySelector('.lightbox-nav-toolbar')!],
    ['sidebar', () => document.querySelector('aside.lightbox-details')!],
  ])('does not close when clicking inside the %s', (_name, getTarget) => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(getTarget());
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('ignores backdrop clicks while an animation is running', () => {
    const { closeLightbox } = renderLightbox({ animating: true });
    fireEvent.click(lightbox());
    expect(closeLightbox).not.toHaveBeenCalled();
  });
});

describe('LightboxContainer — swipe gestures', () => {
  let now: number;
  beforeEach(() => {
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  function swipe(
    dx: number,
    dy: number,
    { duration = 100, pointerType = 'touch' }: { duration?: number; pointerType?: string } = {},
  ) {
    fireEvent.pointerDown(lightbox(), { pointerType, clientX: 200, clientY: 200 });
    now += duration;
    fireEvent.pointerUp(lightbox(), { pointerType, clientX: 200 + dx, clientY: 200 + dy });
  }

  it('swipe left advances to the next image', () => {
    renderLightbox();
    swipe(-60, 0);
    expect(hud()).toHaveTextContent('2 OF 3');
  });

  it('swipe right goes to the previous image (wrapping)', () => {
    renderLightbox();
    swipe(60, 10);
    expect(hud()).toHaveTextContent('3 OF 3');
  });

  it('works for pen pointers too', () => {
    renderLightbox();
    swipe(-80, 0, { pointerType: 'pen' });
    expect(hud()).toHaveTextContent('2 OF 3');
  });

  it.each([
    ['horizontal travel at threshold (50px)', -50, 0, 100],
    ['vertical drift at threshold (75px)', -100, 75, 100],
    ['duration at threshold (500ms)', -100, 0, 500],
    ['tiny movement (tap)', -5, 2, 50],
  ])('ignores gestures with %s', (_label, dx, dy, duration) => {
    const { closeLightbox } = renderLightbox();
    swipe(dx, dy, { duration });
    expect(hud()).toHaveTextContent('1 OF 3');
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('accepts gestures just inside every threshold', () => {
    renderLightbox();
    swipe(-51, 74, { duration: 499 });
    expect(hud()).toHaveTextContent('2 OF 3');
  });

  it('ignores mouse pointers entirely', () => {
    renderLightbox();
    swipe(-200, 0, { pointerType: 'mouse' });
    expect(hud()).toHaveTextContent('1 OF 3');
  });

  it('ignores a pointerup with no matching pointerdown', () => {
    renderLightbox();
    fireEvent.pointerUp(lightbox(), { pointerType: 'touch', clientX: 0, clientY: 0 });
    expect(hud()).toHaveTextContent('1 OF 3');
  });

  it('ignores a mouse pointerup after a touch pointerdown', () => {
    renderLightbox();
    fireEvent.pointerDown(lightbox(), { pointerType: 'touch', clientX: 200, clientY: 200 });
    fireEvent.pointerUp(lightbox(), { pointerType: 'mouse', clientX: 0, clientY: 200 });
    expect(hud()).toHaveTextContent('1 OF 3');
  });

  it('pointercancel aborts an in-progress swipe', () => {
    renderLightbox();
    fireEvent.pointerDown(lightbox(), { pointerType: 'touch', clientX: 200, clientY: 200 });
    fireEvent.pointerCancel(lightbox(), { pointerType: 'touch' });
    fireEvent.pointerUp(lightbox(), { pointerType: 'touch', clientX: 50, clientY: 200 });
    expect(hud()).toHaveTextContent('1 OF 3');
  });

  it('each swipe consumes its start point (second pointerup is ignored)', () => {
    renderLightbox();
    swipe(-100, 0);
    fireEvent.pointerUp(lightbox(), { pointerType: 'touch', clientX: 0, clientY: 200 });
    expect(hud()).toHaveTextContent('2 OF 3');
  });

  it('sets touch-action pan-y so vertical scrolling is left to the browser', () => {
    renderLightbox();
    expect(lightbox().style.touchAction).toBe('pan-y');
  });
});

describe('LightboxContainer — share', () => {
  const shareBtn = () => screen.getByRole('button', { name: 'Share image' });

  function setNavigator(key: 'share' | 'clipboard', value: unknown) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
  }

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).share;
    delete (navigator as unknown as Record<string, unknown>).clipboard;
  });

  async function clickShare() {
    await act(async () => {
      fireEvent.click(shareBtn());
    });
  }

  it('uses navigator.share with an ?img= deep link when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator('share', share);
    const { closeLightbox } = renderLightbox({ initialIndex: 1 });
    await clickShare();
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0];
    expect(arg.title).toBe('Fringe Matrix');
    expect(arg.text).toBe('two.jpg');
    expect(new URL(arg.url).searchParams.get('img')).toBe('/avatars/two.jpg');
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('prefers the permanent image id over src for the ?img= param', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator('share', share);
    renderLightbox({
      images: [{ fileName: 'x.jpg', src: '/avatars/x.jpg', id: 'img-uuid-1' } as ImageData],
    });
    await clickShare();
    expect(new URL(share.mock.calls[0][0].url).searchParams.get('img')).toBe('img-uuid-1');
  });

  it('swallows a rejected navigator.share (user cancelled)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    setNavigator('share', share);
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    renderLightbox();
    await clickShare();
    expect(share).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard and alerts when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator('clipboard', { writeText });
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    renderLightbox();
    await clickShare();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(new URL(writeText.mock.calls[0][0]).searchParams.get('img')).toBe('/avatars/one.jpg');
    expect(alertSpy).toHaveBeenCalledWith('Link copied to clipboard');
  });

  it('does not alert when clipboard write is denied', async () => {
    setNavigator('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    renderLightbox();
    await clickShare();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does nothing when neither share nor clipboard exist', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    renderLightbox();
    await expect(clickShare()).resolves.toBeUndefined();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the current image has no src', async () => {
    const share = vi.fn();
    setNavigator('share', share);
    renderLightbox({ images: [{ fileName: 'loading.jpg', src: null }] });
    await clickShare();
    expect(share).not.toHaveBeenCalled();
  });
});

describe('LightboxContainer — details drawer', () => {
  const infoBtn = () => document.querySelector('.lightbox-info-btn') as HTMLButtonElement;
  const drawer = () => document.getElementById('lightbox-details-drawer');

  it('opens and closes via the info toggle, updating aria state', () => {
    const { closeLightbox } = renderLightbox();
    expect(infoBtn()).toHaveAttribute('aria-expanded', 'false');
    expect(infoBtn()).toHaveAttribute('aria-label', 'Show image details');
    fireEvent.click(infoBtn());
    expect(drawer()).not.toBeNull();
    expect(infoBtn()).toHaveAttribute('aria-expanded', 'true');
    expect(infoBtn()).toHaveAttribute('aria-label', 'Hide image details');
    fireEvent.click(infoBtn());
    expect(drawer()).toBeNull();
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('moves focus into the drawer when it opens', () => {
    renderLightbox();
    fireEvent.click(infoBtn());
    flushRaf();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close image details' }));
  });

  it('drawer close button closes it and returns focus to the info toggle', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(infoBtn());
    fireEvent.click(screen.getByRole('button', { name: 'Close image details' }));
    expect(drawer()).toBeNull();
    flushRaf();
    expect(document.activeElement).toBe(infoBtn());
    expect(closeLightbox).not.toHaveBeenCalled();
  });

  it('clicks inside the drawer do not close the lightbox', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(infoBtn());
    fireEvent.click(drawer()!);
    expect(closeLightbox).not.toHaveBeenCalled();
    expect(drawer()).not.toBeNull();
  });

  it('Escape closes the drawer first, then the lightbox', () => {
    const { closeLightbox } = renderLightbox();
    fireEvent.click(infoBtn());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer()).toBeNull();
    expect(closeLightbox).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeLightbox).toHaveBeenCalledTimes(1);
  });

  it('auto-closes when the viewport widens to the desktop breakpoint', () => {
    renderLightbox();
    fireEvent.click(infoBtn());
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(drawer()).not.toBeNull();
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(drawer()).toBeNull();
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true, writable: true });
  });

  it('moves focus to Close (not <body>) when a resize closes a focused drawer', () => {
    renderLightbox();
    fireEvent.click(infoBtn());
    const drawerClose = drawer()!.querySelector('button') as HTMLButtonElement;
    drawerClose.focus();
    expect(document.activeElement).toBe(drawerClose);

    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    flushRaf();
    expect(drawer()).toBeNull();
    expect(document.activeElement?.id).toBe('lightbox-close');
  });

  it('resets the drawer when the lightbox closes and reopens', () => {
    const closeLightbox = vi.fn();
    const { rerender } = render(<Harness closeLightbox={closeLightbox} />);
    fireEvent.click(infoBtn());
    expect(drawer()).not.toBeNull();
    rerender(<Harness closeLightbox={closeLightbox} isLightboxOpen={false} />);
    rerender(<Harness closeLightbox={closeLightbox} isLightboxOpen />);
    expect(drawer()).toBeNull();
  });
});

describe('LightboxContainer — Tab focus trap', () => {
  // jsdom has no layout, so offsetParent is always null and the trap's
  // visibility filter would drop every element. Treat attached elements
  // as visible for these tests.
  let originalOffsetParent: PropertyDescriptor | undefined;
  beforeEach(() => {
    originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement;
      },
    });
  });
  afterEach(() => {
    if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent);
  });

  function tab(shiftKey = false) {
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return ev;
  }

  function focusables(container: Element) {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  it('wraps Tab from the last control to the first', () => {
    renderLightbox();
    const els = focusables(lightbox());
    els[els.length - 1].focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(els[0]);
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    renderLightbox();
    const els = focusables(lightbox());
    els[0].focus();
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(els[els.length - 1]);
  });

  it('pulls focus back in when it escaped the lightbox', () => {
    renderLightbox();
    const els = focusables(lightbox());
    screen.getByText('gallery-behind').focus();
    tab();
    expect(document.activeElement).toBe(els[0]);
    screen.getByText('gallery-behind').focus();
    tab(true);
    expect(document.activeElement).toBe(els[els.length - 1]);
  });

  it('lets Tab move normally between middle controls', () => {
    renderLightbox();
    const els = focusables(lightbox());
    els[1].focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(tab(true).defaultPrevented).toBe(false);
  });

  it('traps focus inside the drawer while it is open', () => {
    renderLightbox();
    fireEvent.click(document.querySelector('.lightbox-info-btn')!);
    const drawerEl = document.getElementById('lightbox-details-drawer')!;
    const els = focusables(drawerEl);
    els[els.length - 1].focus();
    tab();
    expect(document.activeElement).toBe(els[0]);
    expect(els[0]).toHaveAccessibleName('Close image details');
  });

  it('does nothing when no visible focusable elements exist', () => {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get: () => null,
    });
    renderLightbox();
    const outside = screen.getByText('gallery-behind');
    outside.focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
  });
});
