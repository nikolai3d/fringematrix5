import { describe, it, expect, vi, afterEach } from 'vitest';
import { escapeForAttributeSelector } from '../../src/utils/escapeForAttributeSelector';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('escapeForAttributeSelector', () => {
  it('delegates to CSS.escape when available', () => {
    const escape = vi.fn((v: string) => `ESC(${v})`);
    vi.stubGlobal('CSS', { escape });
    expect(escapeForAttributeSelector('a"b')).toBe('ESC(a"b)');
    expect(escape).toHaveBeenCalledWith('a"b');
  });

  it('coerces non-string input to string', () => {
    const escape = vi.fn((v: string) => v);
    vi.stubGlobal('CSS', { escape });
    expect(escapeForAttributeSelector(42 as unknown as string)).toBe('42');
    expect(escape).toHaveBeenCalledWith('42');
  });

  it('falls back to regex escaping when CSS is undefined', () => {
    vi.stubGlobal('CSS', undefined);
    expect(escapeForAttributeSelector('/avatars/a b"c\\d.jpg')).toBe(
      '\\/avatars\\/a\\ b\\"c\\\\d\\.jpg',
    );
  });

  it('falls back when CSS.escape is not a function', () => {
    vi.stubGlobal('CSS', { escape: 'nope' });
    expect(escapeForAttributeSelector('x.y')).toBe('x\\.y');
  });

  it('leaves word characters untouched in the fallback', () => {
    vi.stubGlobal('CSS', undefined);
    expect(escapeForAttributeSelector('abc_DEF_123')).toBe('abc_DEF_123');
  });

  it('falls back when accessing CSS.escape throws', () => {
    const throwingCSS = {};
    Object.defineProperty(throwingCSS, 'escape', {
      get() {
        throw new Error('blocked');
      },
    });
    vi.stubGlobal('CSS', throwingCSS);
    expect(escapeForAttributeSelector("it's")).toBe("it\\'s");
  });

  it('fallback output is usable in a real attribute selector', () => {
    vi.stubGlobal('CSS', undefined);
    const src = '/avatars/weird "name" [1].jpg';
    const img = document.createElement('img');
    img.setAttribute('src', src);
    document.body.appendChild(img);
    try {
      expect(document.querySelector(`img[src="${escapeForAttributeSelector(src)}"]`)).toBe(img);
    } finally {
      img.remove();
    }
  });
});
