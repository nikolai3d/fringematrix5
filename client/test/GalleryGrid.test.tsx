import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GalleryGrid from '../src/components/GalleryGrid';
import type { ImageData } from '../src/types/api';

function makeImage(overrides: Partial<ImageData> = {}): ImageData {
  return {
    fileName: 'avatar.png',
    src: 'https://cdn.example.com/avatar.png',
    isLoading: false,
    loadedSrc: 'https://cdn.example.com/avatar.png',
    ...overrides,
  };
}

describe('GalleryGrid — image card rendering', () => {
  it('renders one card per image', () => {
    const images = [
      makeImage({ fileName: 'a.png', src: 'https://cdn.example.com/a.png', loadedSrc: 'https://cdn.example.com/a.png' }),
      makeImage({ fileName: 'b.png', src: 'https://cdn.example.com/b.png', loadedSrc: 'https://cdn.example.com/b.png' }),
      makeImage({ fileName: 'c.png', src: 'https://cdn.example.com/c.png', loadedSrc: 'https://cdn.example.com/c.png' }),
    ];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('renders the filename for each image card', () => {
    const images = [
      makeImage({ fileName: 'fringe-avatar.png' }),
      makeImage({ fileName: 'walter-bishop.jpg' }),
    ];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getByText('fringe-avatar.png')).toBeTruthy();
    expect(screen.getByText('walter-bishop.jpg')).toBeTruthy();
  });

  it('renders the image src as the img element src', () => {
    const images = [makeImage({ loadedSrc: 'https://cdn.example.com/specific.png' })];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/specific.png');
  });

  it('uses the fileName as the img alt text', () => {
    const images = [makeImage({ fileName: 'my-avatar.png' })];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getByAltText('my-avatar.png')).toBeTruthy();
  });
});

describe('GalleryGrid — click handler', () => {
  it('calls onImageClick with correct index when first image is clicked', () => {
    const onImageClick = vi.fn();
    const images = [
      makeImage({ fileName: 'first.png' }),
      makeImage({ fileName: 'second.png' }),
    ];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={onImageClick} />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[0]);
    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(onImageClick.mock.calls[0][0]).toBe(0);
  });

  it('calls onImageClick with correct index when a middle image is clicked', () => {
    const onImageClick = vi.fn();
    const images = [
      makeImage({ fileName: 'first.png' }),
      makeImage({ fileName: 'second.png' }),
      makeImage({ fileName: 'third.png' }),
    ];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={onImageClick} />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[1]);
    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(onImageClick.mock.calls[0][0]).toBe(1);
  });

  it('calls onImageClick with the img element as the second argument', () => {
    const onImageClick = vi.fn();
    const images = [makeImage({ fileName: 'avatar.png' })];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={onImageClick} />);
    const img = screen.getByRole('img');
    fireEvent.click(img);
    expect(onImageClick.mock.calls[0][1]).toBe(img);
  });
});

describe('GalleryGrid — empty state', () => {
  it('renders the empty state when hasCampaign=true and images=[]', () => {
    render(<GalleryGrid images={[]} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('No Images In Campaign')).toBeTruthy();
    expect(screen.getByText('This campaign has no uploaded images yet.')).toBeTruthy();
  });

  it('adds the "empty" class to the gallery section when in empty state', () => {
    const { container } = render(<GalleryGrid images={[]} hasCampaign={true} onImageClick={vi.fn()} />);
    const section = container.querySelector('section#gallery');
    expect(section?.classList.contains('empty')).toBe(true);
  });

  it('does NOT render empty state when hasCampaign=false and images=[]', () => {
    render(<GalleryGrid images={[]} hasCampaign={false} onImageClick={vi.fn()} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('No Images In Campaign')).toBeNull();
  });

  it('does NOT render empty state when images are present', () => {
    const images = [makeImage()];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('No Images In Campaign')).toBeNull();
  });
});

describe('GalleryGrid — loading placeholder', () => {
  it('renders a loading placeholder (not an img) when isLoading=true', () => {
    const images = [makeImage({ isLoading: true, loadedSrc: null })];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the filename alongside the loading placeholder', () => {
    const images = [makeImage({ fileName: 'pending.png', isLoading: true, loadedSrc: null })];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getByText('pending.png')).toBeTruthy();
  });

  it('renders an img (not a placeholder) when isLoading=false', () => {
    const images = [makeImage({ isLoading: false })];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getByRole('img')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('renders mixed loaded and loading cards correctly', () => {
    const images = [
      makeImage({ fileName: 'loaded.png', isLoading: false }),
      makeImage({ fileName: 'loading.png', isLoading: true, loadedSrc: null }),
    ];
    render(<GalleryGrid images={images} hasCampaign={true} onImageClick={vi.fn()} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
