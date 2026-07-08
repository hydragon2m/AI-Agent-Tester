import { requestJson } from './client';

// Danh sách tất cả systems.
export function fetchSystems() {
  return requestJson('/api/systems');
}

// Chi tiết 1 system + danh sách project thuộc system (kèm template + trạng thái test plan).
export function fetchSystem(id) {
  return requestJson(`/api/systems/${encodeURIComponent(id)}`);
}

export function createSystemApi(payload) {
  return requestJson('/api/systems', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSystemApi(id, payload) {
  return requestJson(`/api/systems/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteSystemApi(id) {
  return requestJson(`/api/systems/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
