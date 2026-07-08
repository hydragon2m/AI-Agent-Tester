import { requestJson } from './client';

export function fetchNodes() {
  return requestJson('/tree');
}

export function createNodeApi(payload) {
  return requestJson('/tree', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateNodeApi(id, payload) {
  return requestJson(`/tree/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteNodeApi(id) {
  return requestJson(`/tree/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
