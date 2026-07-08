import { requestJson } from './client';

export function fetchProviderStatusApi() {
  return requestJson('/api/ai/status');
}

export function fetchProviderSettingsApi() {
  return requestJson('/api/providers/settings');
}

export function saveProviderSettingApi(payload) {
  return requestJson('/api/providers/settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
