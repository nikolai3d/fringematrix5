import { describe, it, expect } from 'vitest';
import { gitRemoteToHttps } from '../src/utils/gitRemoteToHttps.js';

describe('gitRemoteToHttps', () => {
  it('converts scp-like syntax', () => {
    expect(gitRemoteToHttps('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo');
  });

  it('normalizes protocols to https', () => {
    expect(gitRemoteToHttps('git+https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
    expect(gitRemoteToHttps('ssh://github.com/owner/repo')).toBe('https://github.com/owner/repo');
    expect(gitRemoteToHttps('http://github.com/owner/repo')).toBe('https://github.com/owner/repo');
  });

  it('returns empty string for invalid', () => {
    expect(gitRemoteToHttps('')).toBe('');
    expect(gitRemoteToHttps('not-a-url')).toBe('');
  });
});


