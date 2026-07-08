import { requestJson } from './client';

// Lấy strategy hiện tại (bản mới nhất) của 1 project. Trả về null nếu chưa có.
export function fetchStrategyApi(projectId) {
  return requestJson(`/api/strategies?projectId=${encodeURIComponent(projectId)}`);
}

// Tạo strategy mới (mỗi lần approve/lưu = 1 revision mới).
export function createStrategyApi(payload) {
  return requestJson('/api/strategies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Cập nhật toggle/nội dung/approve của 1 strategy đã lưu (không tạo revision mới).
export function updateStrategyApi(id, payload) {
  return requestJson(`/api/strategies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteStrategyApi(id) {
  return requestJson(`/api/strategies/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Release check — tiến độ test theo stage của project (% pass, blockers, Go/No-go).
export function fetchReleaseCheckApi(projectId) {
  return requestJson(`/api/strategies/release-check?projectId=${encodeURIComponent(projectId)}`);
}
