export async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Failed to fetch ${url} (status ${res.status}). ${body?.slice(0, 200) || ''}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Expected JSON from ${url} but got '${contentType}'. Body starts: ${body.slice(0, 80)}`);
  }
  return res.json();
}


