/**
 * Unit tests for client/src/config/site.ts
 *
 * Tests SITE_URL and SITE_SHARE_TEXT fallback behaviour when
 * config.site.url / config.site.shareText is missing, empty, or not a string.
 *
 * Strategy: vi.doMock (not hoisted) + vi.resetModules + dynamic import gives
 * each test group a fresh module with its own config mock. This is the same
 * approach used in theme.test.js to avoid YAML import issues in the test env.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SITE_URL_DEFAULT, SITE_SHARE_TEXT_DEFAULT } from '../src/config/site.ts';

/**
 * Helper: mocks config.yaml with the given config object, then
 * dynamically imports a fresh copy of site.ts and returns its exports.
 *
 * The mock path '../config.yaml' is relative to this test file (client/test/),
 * which resolves to client/config.yaml — the same file that site.ts imports
 * as '../../config.yaml'. Vitest matches mocks by resolved absolute path,
 * so both paths hit the same module cache entry.
 */
async function importSiteWithConfig(mockConfig) {
  vi.resetModules();
  vi.doMock('../config.yaml', () => ({ default: mockConfig }));
  const mod = await import('../src/config/site.ts');
  return mod;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// 1. Valid config — values are read from config.yaml
// ---------------------------------------------------------------------------
describe('site.ts — valid config values', () => {
  it('SITE_URL equals the url from config when it is a non-empty string', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 'https://example.com', shareText: 'Hello' },
    });
    expect(mod.SITE_URL).toBe('https://example.com');
  });

  it('SITE_SHARE_TEXT equals the shareText from config when it is a non-empty string', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 'https://example.com', shareText: 'Hello' },
    });
    expect(mod.SITE_SHARE_TEXT).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// 2. SITE_URL fallback paths
// ---------------------------------------------------------------------------
describe('site.ts — SITE_URL fallback', () => {
  it('falls back to default when config.site is undefined (site key missing)', async () => {
    const mod = await importSiteWithConfig({});
    expect(mod.SITE_URL).toBe(SITE_URL_DEFAULT);
  });

  it('falls back to default when config.site.url is undefined', async () => {
    const mod = await importSiteWithConfig({ site: { shareText: 'Hello' } });
    expect(mod.SITE_URL).toBe(SITE_URL_DEFAULT);
  });

  it('falls back to default when config.site.url is an empty string', async () => {
    const mod = await importSiteWithConfig({
      site: { url: '', shareText: 'Hello' },
    });
    expect(mod.SITE_URL).toBe(SITE_URL_DEFAULT);
  });

  it('falls back to default when config.site.url is a whitespace-only string', async () => {
    const mod = await importSiteWithConfig({
      site: { url: '   ', shareText: 'Hello' },
    });
    expect(mod.SITE_URL).toBe(SITE_URL_DEFAULT);
  });

  it('falls back to default when config.site.url is a number (not a string)', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 42, shareText: 'Hello' },
    });
    expect(mod.SITE_URL).toBe(SITE_URL_DEFAULT);
  });

  it('falls back to default when config.site.url is null', async () => {
    const mod = await importSiteWithConfig({
      site: { url: null, shareText: 'Hello' },
    });
    expect(mod.SITE_URL).toBe(SITE_URL_DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// 3. SITE_SHARE_TEXT fallback paths
// ---------------------------------------------------------------------------
describe('site.ts — SITE_SHARE_TEXT fallback', () => {
  it('falls back to default when config.site is undefined (site key missing)', async () => {
    const mod = await importSiteWithConfig({});
    expect(mod.SITE_SHARE_TEXT).toBe(SITE_SHARE_TEXT_DEFAULT);
  });

  it('falls back to default when config.site.shareText is undefined', async () => {
    const mod = await importSiteWithConfig({ site: { url: 'https://example.com' } });
    expect(mod.SITE_SHARE_TEXT).toBe(SITE_SHARE_TEXT_DEFAULT);
  });

  it('falls back to default when config.site.shareText is an empty string', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 'https://example.com', shareText: '' },
    });
    expect(mod.SITE_SHARE_TEXT).toBe(SITE_SHARE_TEXT_DEFAULT);
  });

  it('falls back to default when config.site.shareText is a whitespace-only string', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 'https://example.com', shareText: '   ' },
    });
    expect(mod.SITE_SHARE_TEXT).toBe(SITE_SHARE_TEXT_DEFAULT);
  });

  it('falls back to default when config.site.shareText is a number (not a string)', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 'https://example.com', shareText: 99 },
    });
    expect(mod.SITE_SHARE_TEXT).toBe(SITE_SHARE_TEXT_DEFAULT);
  });

  it('falls back to default when config.site.shareText is null', async () => {
    const mod = await importSiteWithConfig({
      site: { url: 'https://example.com', shareText: null },
    });
    expect(mod.SITE_SHARE_TEXT).toBe(SITE_SHARE_TEXT_DEFAULT);
  });
});
