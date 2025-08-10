export function gitRemoteToHttps(remote) {
  if (!remote || typeof remote !== 'string') return '';
  const trimmed = remote.trim();

  // Handle scp-like syntax: git@host:owner/repo.git
  const scpLikeMatch = trimmed.match(/^[\w.-]+@([^:]+):(.+)$/);
  if (scpLikeMatch) {
    const host = scpLikeMatch[1];
    let path = scpLikeMatch[2];
    if (path.endsWith('.git')) path = path.slice(0, -4);
    return `https://${host}/${path}`;
  }

  // Normalize common protocols to https
  let candidate = trimmed.replace(/^git\+/, '');
  candidate = candidate.replace(/^git:\/\//, 'https://');
  candidate = candidate.replace(/^ssh:\/\//, 'https://');
  candidate = candidate.replace(/^http:\/\//, 'https://');

  try {
    const u = new URL(candidate);
    let path = u.pathname || '';
    if (path.startsWith('/')) path = path.slice(1);
    if (path.endsWith('.git')) path = path.slice(0, -4);
    if (!u.hostname || !path) return '';
    return `https://${u.hostname}/${path}`;
  } catch {
    // As a last resort, if it looks like host/path(.git)
    const bare = candidate.replace(/^\/*/, '');
    const m = bare.match(/^([^/]+)\/(.+)$/);
    if (m) {
      let path = m[2];
      if (path.endsWith('.git')) path = path.slice(0, -4);
      return `https://${m[1]}/${path}`;
    }
  }
  return '';
}


