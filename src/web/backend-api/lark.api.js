import { requestJson } from './client';

export function fetchLarkConfigApi() {
  return requestJson('/api/lark/config');
}

export function saveLarkConfigApi(payload) {
  return requestJson('/api/lark/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function testLarkConnectionApi() {
  return requestJson('/api/lark/test-connection', { method: 'POST' });
}

export function fetchLarkLinkApi(nodeId) {
  return requestJson(`/api/lark/link?node_id=${encodeURIComponent(nodeId)}`);
}

export function linkLarkProjectApi(nodeId, url) {
  return requestJson('/api/lark/link', {
    method: 'POST',
    body: JSON.stringify({ node_id: nodeId, url }),
  });
}

// Push a whole scope (system/project/module/screen/feature) to a Lark Base
// given by URL — one table per project. Server does everything with code +
// Lark API → 0 AI token.
export function pushScopeToLarkApi({ scopeType, scopeId, url, saveLink }) {
  return requestJson('/api/lark/push-scope', {
    method: 'POST',
    body: JSON.stringify({ scopeType, scopeId, url, saveLink }),
  });
}

// Custom fetch (not requestJson) so a 409 NOT_LINKED response can be
// distinguished from a regular failure via error.code, not just message text.
export async function pushToLarkApi(nodeId) {
  const res = await fetch('/api/lark/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_id: nodeId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `HTTP ${res.status}`);
    err.code = body?.error;
    throw err;
  }
  return body;
}
