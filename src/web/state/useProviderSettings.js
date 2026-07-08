import { useEffect, useState } from 'react';
import { fetchProviderSettingsApi, fetchProviderStatusApi, saveProviderSettingApi } from '../backend-api/providers.api';

// Chỉ dùng Gemini và Codex trên UI Settings
const DEFAULT_PROVIDER_FORM = {
  gemini: { key: '', enabled: true, priority: 1, hasKey: false },
  codex: { key: '', enabled: true, priority: 2, hasKey: false, api_base: '', model_name: '' },
};

export function useProviderSettings(onToast) {
  const [providerStatus, setProviderStatus] = useState({});
  const [providerForm, setProviderForm] = useState(DEFAULT_PROVIDER_FORM);

  async function fetchProviderStatus() {
    setProviderStatus(await fetchProviderStatusApi());
  }

  async function fetchProviderSettings() {
    const rows = await fetchProviderSettingsApi();
    setProviderForm(prev => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.provider]) continue;
        next[row.provider] = {
          ...next[row.provider],
          enabled: row.enabled,
          priority: row.priority,
          hasKey: row.hasKey,
          api_base: row.api_base || '',
          model_name: row.model_name || '',
          key: '',
        };
      }
      return next;
    });
  }

  useEffect(() => {
    Promise.all([fetchProviderStatus(), fetchProviderSettings()])
      .catch(e => onToast?.(`Lỗi tải provider: ${e.message}`));
  }, []);

  async function saveProviders() {
    for (const [provider, value] of Object.entries(providerForm)) {
      await saveProviderSettingApi({
        provider,
        key: value.key,
        enabled: value.enabled,
        priority: value.priority,
        api_base: value.api_base,
        model_name: value.model_name,
      });
    }
    await fetchProviderStatus();
    await fetchProviderSettings();
  }

  return {
    providerStatus,
    providerForm,
    setProviderForm,
    saveProviders,
  };
}
