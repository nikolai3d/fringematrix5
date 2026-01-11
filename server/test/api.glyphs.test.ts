import request from 'supertest';
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// Mock blob data for testing
const mockGlyphBlobs = [
  { pathname: 'avatars/_images/Glyphs/small/glyph1.png', url: 'https://cdn.example.com/avatars/_images/Glyphs/small/glyph1.png', size: 1000 },
  { pathname: 'avatars/_images/Glyphs/small/glyph2.jpg', url: 'https://cdn.example.com/avatars/_images/Glyphs/small/glyph2.jpg', size: 2000 },
  { pathname: 'avatars/_images/Glyphs/small/glyph3.webp', url: 'https://cdn.example.com/avatars/_images/Glyphs/small/glyph3.webp', size: 3000 },
  { pathname: 'avatars/_images/Glyphs/small/not-an-image.txt', url: 'https://cdn.example.com/avatars/_images/Glyphs/small/not-an-image.txt', size: 100 },
];

// Mock @vercel/blob before importing the server
jest.unstable_mockModule('@vercel/blob', () => ({
  list: jest.fn().mockResolvedValue({
    blobs: mockGlyphBlobs,
    cursor: undefined,
    hasMore: false,
  }),
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

// Dynamic import after mock is set up
let app: any;

beforeAll(async () => {
  // Ensure BLOB_READ_WRITE_TOKEN is set for the test
  process.env['BLOB_READ_WRITE_TOKEN'] = 'test-token';
  
  // Dynamically import the server after mocking
  const serverModule = await import('../server.ts');
  app = serverModule.default;
});

describe('GET /api/glyphs with mocked blob API', () => {
  it('returns only image files and filters non-image files', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = await request(app).get('/api/glyphs');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('glyphs');
    expect(Array.isArray(res.body.glyphs)).toBe(true);
    
    // Should have glyphs (from mock data)
    expect(res.body.glyphs.length).toBeGreaterThan(0);
    
    // Should filter out non-image files (not-an-image.txt)
    expect(res.body.glyphs.length).toBe(3);
    
    // All returned URLs should be valid and have image extensions
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'];
    res.body.glyphs.forEach((glyph: string) => {
      expect(() => new URL(glyph)).not.toThrow();
      const url = new URL(glyph);
      const pathname = url.pathname.toLowerCase();
      const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
      expect(hasImageExtension).toBe(true);
    });
    
    // Verify the non-image file was filtered out
    const hasNonImage = res.body.glyphs.some((glyph: string) => glyph.includes('not-an-image'));
    expect(hasNonImage).toBe(false);
    
    consoleSpy.mockRestore();
  });

  it('returns correct glyph URLs from blob storage', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = await request(app).get('/api/glyphs');
    
    expect(res.status).toBe(200);
    
    // Verify the expected image URLs are present
    expect(res.body.glyphs).toContain('https://cdn.example.com/avatars/_images/Glyphs/small/glyph1.png');
    expect(res.body.glyphs).toContain('https://cdn.example.com/avatars/_images/Glyphs/small/glyph2.jpg');
    expect(res.body.glyphs).toContain('https://cdn.example.com/avatars/_images/Glyphs/small/glyph3.webp');
    
    consoleSpy.mockRestore();
  });
});
