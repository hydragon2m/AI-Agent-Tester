const API_BASE = (typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_METADATA__ || window.location.protocol.startsWith('tauri') || window.location.protocol.startsWith('asset') || window.location.protocol.startsWith('file')))
  ? 'http://localhost:3001'
  : '';

export async function requestJson(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const bodyText = await res.text().catch(() => '');
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch (err) {
    body = { error: bodyText };
  }
  if (!res.ok) {
    const message = body?.message || body?.error || bodyText || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}
