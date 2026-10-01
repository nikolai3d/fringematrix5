import { describe, it, expect } from 'vitest';
import { gitRemoteToHttps } from '../../src/utils/gitRemoteToHttps';

describe('gitRemoteToHttps — additional branches', () => {
  it('converts git:// protocol', () => {
    expect(gitRemoteToHttps('git://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
  });

  it('trims surrounding whitespace', () => {
    expect(gitRemoteToHttps('  https://github.com/owner/repo.git \n')).toBe('https://github.com/owner/repo');
  });

  it('keeps https URLs without .git as-is (minus trailing slash handling)', () => {
    expect(gitRemoteToHttps('https://gitlab.com/group/sub/repo')).toBe('https://gitlab.com/group/sub/repo');
  });

  it('returns empty for a URL with no path', () => {
    expect(gitRemoteToHttps('https://github.com/')).toBe('');
  });

  it('drops credentials and ports from ssh:// URLs', () => {
    expect(gitRemoteToHttps('ssh://git@github.com:22/owner/repo.git')).toBe('https://github.com/owner/repo');
  });

  it('falls back to host/path parsing for bare remotes', () => {
    expect(gitRemoteToHttps('github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
    expect(gitRemoteToHttps('//github.com/owner/repo')).toBe('https://github.com/owner/repo');
  });

  it('returns empty for null / non-string input', () => {
    expect(gitRemoteToHttps(null)).toBe('');
    expect(gitRemoteToHttps(123 as unknown as string)).toBe('');
  });
});
