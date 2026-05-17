/**
 * Tests for scripts/validate-config.js
 *
 * Uses Node's built-in test runner (node:test), which requires no extra
 * dependencies and works natively with ESM.
 *
 * Run: node --test scripts/validate-config.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfigObject, isValidCssColor, SIDEBAR_LIMITS } from './validate-config.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal valid config
// ---------------------------------------------------------------------------
function validConfig(overrides = {}) {
  return {
    loadingScreen: { type: 'glyphs', autoFadeDelayMs: 300 },
    theme: { accentColor: '#00D4FF' },
    site: { url: 'https://fringematrix.art', shareText: 'Check out Fringe Matrix' },
    lightbox: {
      sidebarAnimation: {
        enterDurationMs: 420,
        exitDurationMs: 320,
        lineHoldMs: 120,
        lineBlinkCount: 2,
        lineBlinkIntervalMs: 90,
        contentFadeInDelayMs: 180,
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isValidCssColor unit tests
// ---------------------------------------------------------------------------
describe('isValidCssColor', () => {
  it('accepts 3-digit hex', () => assert.ok(isValidCssColor('#abc')));
  it('accepts 4-digit hex', () => assert.ok(isValidCssColor('#abcd')));
  it('accepts 6-digit hex', () => assert.ok(isValidCssColor('#00D4FF')));
  it('accepts 8-digit hex', () => assert.ok(isValidCssColor('#00D4FF80')));
  it('accepts rgb()', () => assert.ok(isValidCssColor('rgb(0, 212, 255)')));
  it('accepts rgba()', () => assert.ok(isValidCssColor('rgba(0, 212, 255, 0.5)')));
  it('accepts hsl()', () => assert.ok(isValidCssColor('hsl(190, 100%, 50%)')));
  it('accepts hsla()', () => assert.ok(isValidCssColor('hsla(190, 100%, 50%, 0.5)')));
  it('accepts named color "red"', () => assert.ok(isValidCssColor('red')));
  it('accepts named color "transparent"', () => assert.ok(isValidCssColor('transparent')));
  it('accepts named color with different case', () => assert.ok(isValidCssColor('RED')));

  it('rejects plain text', () => assert.ok(!isValidCssColor('notacolor')));
  it('rejects empty string', () => assert.ok(!isValidCssColor('')));
  it('rejects number', () => assert.ok(!isValidCssColor(42)));
  it('rejects null', () => assert.ok(!isValidCssColor(null)));
  it('rejects malformed hex', () => assert.ok(!isValidCssColor('#gg0000')));
  it('rejects 5-digit hex', () => assert.ok(!isValidCssColor('#12345')));
});

// ---------------------------------------------------------------------------
// validateConfigObject — valid config
// ---------------------------------------------------------------------------
describe('validateConfigObject — valid config', () => {
  it('returns no errors or warnings for a fully valid config', () => {
    const { errors, warnings } = validateConfigObject(validConfig());
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  it('accepts all three valid loadingScreen types', () => {
    for (const type of ['legacy', 'terminal', 'glyphs']) {
      const { errors } = validateConfigObject(validConfig({ loadingScreen: { type, autoFadeDelayMs: 300 } }));
      assert.deepEqual(errors, [], `Expected no errors for type=${type}`);
    }
  });

  it('accepts optional theme section being absent', () => {
    const cfg = validConfig();
    delete cfg.theme;
    const { errors } = validateConfigObject(cfg);
    assert.deepEqual(errors, []);
  });

  it('accepts optional lightbox section being absent', () => {
    const cfg = validConfig();
    delete cfg.lightbox;
    const { errors } = validateConfigObject(cfg);
    assert.deepEqual(errors, []);
  });

  it('accepts boundary value autoFadeDelayMs = 0', () => {
    const { errors } = validateConfigObject(validConfig({ loadingScreen: { type: 'glyphs', autoFadeDelayMs: 0 } }));
    assert.deepEqual(errors, []);
  });

  it('accepts boundary value autoFadeDelayMs = 10000', () => {
    const { errors } = validateConfigObject(validConfig({ loadingScreen: { type: 'glyphs', autoFadeDelayMs: 10000 } }));
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// validateConfigObject — bad theme.accentColor
// ---------------------------------------------------------------------------
describe('validateConfigObject — theme.accentColor', () => {
  it('fails when accentColor is not a valid CSS color', () => {
    const { errors } = validateConfigObject(validConfig({ theme: { accentColor: 'notacolor' } }));
    assert.ok(errors.length > 0, 'Expected at least one error');
    assert.ok(errors.some(e => e.includes('theme.accentColor')), `Expected accentColor error, got: ${errors}`);
  });

  it('fails when accentColor is an integer', () => {
    const { errors } = validateConfigObject(validConfig({ theme: { accentColor: 123 } }));
    assert.ok(errors.some(e => e.includes('theme.accentColor')));
  });

  it('fails when accentColor is an invalid hex string', () => {
    const { errors } = validateConfigObject(validConfig({ theme: { accentColor: '#ZZZZZZ' } }));
    assert.ok(errors.some(e => e.includes('theme.accentColor')));
  });

  it('passes when accentColor is a valid named color', () => {
    const { errors } = validateConfigObject(validConfig({ theme: { accentColor: 'cyan' } }));
    assert.deepEqual(errors, []);
  });

  it('passes when accentColor is a valid rgb() value', () => {
    const { errors } = validateConfigObject(validConfig({ theme: { accentColor: 'rgb(0, 212, 255)' } }));
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// validateConfigObject — lightbox.sidebarAnimation fields
// ---------------------------------------------------------------------------
describe('validateConfigObject — lightbox.sidebarAnimation', () => {
  function sidebarConfig(saOverrides) {
    return validConfig({
      lightbox: {
        sidebarAnimation: {
          enterDurationMs: 420,
          exitDurationMs: 320,
          lineHoldMs: 120,
          lineBlinkCount: 2,
          lineBlinkIntervalMs: 90,
          contentFadeInDelayMs: 180,
          ...saOverrides,
        },
      },
    });
  }

  // Individual fields at invalid (string) values
  for (const field of Object.keys(SIDEBAR_LIMITS)) {
    it(`fails when ${field} is a string`, () => {
      const { errors } = validateConfigObject(sidebarConfig({ [field]: 'bad' }));
      assert.ok(errors.some(e => e.includes(`lightbox.sidebarAnimation.${field}`)),
        `Expected error for ${field}=string, got: ${errors}`);
    });
  }

  // Out-of-range values
  it('fails when enterDurationMs is below 0', () => {
    const { errors } = validateConfigObject(sidebarConfig({ enterDurationMs: -1 }));
    assert.ok(errors.some(e => e.includes('enterDurationMs')));
  });

  it('fails when enterDurationMs exceeds 2000', () => {
    const { errors } = validateConfigObject(sidebarConfig({ enterDurationMs: 2001 }));
    assert.ok(errors.some(e => e.includes('enterDurationMs')));
  });

  it('fails when exitDurationMs is below 0', () => {
    const { errors } = validateConfigObject(sidebarConfig({ exitDurationMs: -1 }));
    assert.ok(errors.some(e => e.includes('exitDurationMs')));
  });

  it('fails when exitDurationMs exceeds 2000', () => {
    const { errors } = validateConfigObject(sidebarConfig({ exitDurationMs: 2001 }));
    assert.ok(errors.some(e => e.includes('exitDurationMs')));
  });

  it('fails when lineHoldMs is below 0', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineHoldMs: -1 }));
    assert.ok(errors.some(e => e.includes('lineHoldMs')));
  });

  it('fails when lineHoldMs exceeds 1000', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineHoldMs: 1001 }));
    assert.ok(errors.some(e => e.includes('lineHoldMs')));
  });

  it('fails when lineBlinkIntervalMs is below 10', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkIntervalMs: 9 }));
    assert.ok(errors.some(e => e.includes('lineBlinkIntervalMs')));
  });

  it('fails when lineBlinkIntervalMs exceeds 1000', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkIntervalMs: 1001 }));
    assert.ok(errors.some(e => e.includes('lineBlinkIntervalMs')));
  });

  it('fails when contentFadeInDelayMs is below 0', () => {
    const { errors } = validateConfigObject(sidebarConfig({ contentFadeInDelayMs: -1 }));
    assert.ok(errors.some(e => e.includes('contentFadeInDelayMs')));
  });

  it('fails when contentFadeInDelayMs exceeds 2000', () => {
    const { errors } = validateConfigObject(sidebarConfig({ contentFadeInDelayMs: 2001 }));
    assert.ok(errors.some(e => e.includes('contentFadeInDelayMs')));
  });

  // lineBlinkCount — must be integer in [0, 10]
  it('fails when lineBlinkCount is below 0', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkCount: -1 }));
    assert.ok(errors.some(e => e.includes('lineBlinkCount')));
  });

  it('fails when lineBlinkCount exceeds 10', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkCount: 11 }));
    assert.ok(errors.some(e => e.includes('lineBlinkCount')));
  });

  it('fails when lineBlinkCount is a non-integer (float)', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkCount: 2.5 }));
    assert.ok(errors.some(e => e.includes('lineBlinkCount') && e.includes('integer')),
      `Expected integer error for lineBlinkCount=2.5, got: ${errors}`);
  });

  it('passes when lineBlinkCount is 0 (boundary)', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkCount: 0 }));
    assert.deepEqual(errors, []);
  });

  it('passes when lineBlinkCount is 10 (boundary)', () => {
    const { errors } = validateConfigObject(sidebarConfig({ lineBlinkCount: 10 }));
    assert.deepEqual(errors, []);
  });

  it('passes when sidebarAnimation fields are omitted (all optional)', () => {
    const { errors } = validateConfigObject(validConfig({ lightbox: { sidebarAnimation: {} } }));
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// validateConfigObject — site section
// ---------------------------------------------------------------------------
describe('validateConfigObject — site', () => {
  it('passes when site.url is a valid https URL', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'https://example.com', shareText: 'Check it out' } }));
    assert.deepEqual(errors, []);
  });

  it('passes when site.url is a valid http URL', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'http://example.com', shareText: 'Check it out' } }));
    assert.deepEqual(errors, []);
  });

  it('fails when site.url is not a valid URL', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'not-a-url', shareText: 'Check it out' } }));
    assert.ok(errors.some(e => e.includes('site.url')), `Expected site.url error, got: ${errors}`);
  });

  it('passes when site.url is an ftp URL (validator uses URL() with no protocol restriction)', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'ftp://example.com', shareText: 'Check it out' } }));
    assert.deepEqual(errors, []);
  });

  it('fails when site.url has no protocol (not parseable by URL())', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'just-text-no-protocol', shareText: 'Check it out' } }));
    assert.ok(errors.some(e => e.includes('site.url')), `Expected site.url error, got: ${errors}`);
  });

  it('fails when site.shareText is an empty string', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'https://example.com', shareText: '' } }));
    assert.ok(errors.some(e => e.includes('site.shareText')), `Expected site.shareText error, got: ${errors}`);
  });

  it('fails when site.shareText is a whitespace-only string', () => {
    const { errors } = validateConfigObject(validConfig({ site: { url: 'https://example.com', shareText: '   ' } }));
    assert.ok(errors.some(e => e.includes('site.shareText')), `Expected site.shareText error, got: ${errors}`);
  });
});

// ---------------------------------------------------------------------------
// validateConfigObject — non-object section types
// ---------------------------------------------------------------------------
describe('validateConfigObject — non-object section types', () => {
  it('fails when theme section is a string (not an object)', () => {
    const cfg = validConfig({ theme: 'not-an-object' });
    const { errors } = validateConfigObject(cfg);
    assert.ok(errors.some(e => e.includes('theme')), `Expected theme error, got: ${errors}`);
  });

  it('fails when theme section is a number (not an object)', () => {
    const cfg = validConfig({ theme: 42 });
    const { errors } = validateConfigObject(cfg);
    assert.ok(errors.some(e => e.includes('theme')), `Expected theme error, got: ${errors}`);
  });

  it('fails when lightbox section is a string (not an object)', () => {
    const cfg = validConfig({ lightbox: 'not-an-object' });
    const { errors } = validateConfigObject(cfg);
    assert.ok(errors.some(e => e.includes('lightbox')), `Expected lightbox error, got: ${errors}`);
  });

  it('fails when lightbox section is a number (not an object)', () => {
    const cfg = validConfig({ lightbox: 123 });
    const { errors } = validateConfigObject(cfg);
    assert.ok(errors.some(e => e.includes('lightbox')), `Expected lightbox error, got: ${errors}`);
  });
});

// ---------------------------------------------------------------------------
// validateConfigObject — loadingScreen validation
// ---------------------------------------------------------------------------
describe('validateConfigObject — loadingScreen', () => {
  it('fails when loadingScreen section is missing', () => {
    const { errors } = validateConfigObject({});
    assert.ok(errors.some(e => e.includes('loadingScreen')));
  });

  it('fails when loadingScreen.type is invalid', () => {
    const { errors } = validateConfigObject(validConfig({ loadingScreen: { type: 'invalid', autoFadeDelayMs: 300 } }));
    assert.ok(errors.some(e => e.includes('loadingScreen.type')));
  });

  it('warns when autoFadeDelayMs is absent', () => {
    const { errors, warnings } = validateConfigObject(validConfig({ loadingScreen: { type: 'glyphs' } }));
    assert.deepEqual(errors, []);
    assert.ok(warnings.some(w => w.includes('autoFadeDelayMs')));
  });

  it('fails when autoFadeDelayMs is below 0', () => {
    const { errors } = validateConfigObject(validConfig({ loadingScreen: { type: 'glyphs', autoFadeDelayMs: -1 } }));
    assert.ok(errors.some(e => e.includes('autoFadeDelayMs')));
  });

  it('fails when autoFadeDelayMs exceeds 10000', () => {
    const { errors } = validateConfigObject(validConfig({ loadingScreen: { type: 'glyphs', autoFadeDelayMs: 10001 } }));
    assert.ok(errors.some(e => e.includes('autoFadeDelayMs')));
  });
});
