export async function requestJson(url, options = {}) {
  const res = await fetch(url, {
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
