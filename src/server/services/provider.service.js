const { dbRun, dbGet, dbAll } = require('../db/db_manager');
const { encrypt, decrypt } = require('../utils/crypto');

async function getProviderSettings() {
  const rows = await dbAll('SELECT * FROM provider_settings');
  return rows.map(r => ({
    id: r.id,
    provider: r.provider,
    enabled: !!r.enabled,
    priority: r.priority,
    hasKey: !!r.encrypted_key && r.encrypted_key.length > 0,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
}

async function saveProviderSetting(provider, rawKey, enabled, priority) {
  const existing = await dbGet('SELECT * FROM provider_settings WHERE provider = ?', [provider]);
  const nowStr = new Date().toISOString();
  
  let encryptedKey = existing ? existing.encrypted_key : '';
  if (rawKey && rawKey.trim().length > 0) {
    encryptedKey = encrypt(rawKey.trim());
  }

  const enabledVal = enabled ? 1 : 0;
  const prioVal = typeof priority === 'number' ? priority : 1;

  if (existing) {
    await dbRun(
      `UPDATE provider_settings 
       SET encrypted_key = ?, enabled = ?, priority = ?, updated_at = ? 
       WHERE provider = ?`,
      [encryptedKey, enabledVal, prioVal, nowStr, provider]
    );
  } else {
    const id = 'prov_' + Date.now().toString() + '_' + provider;
    await dbRun(
      `INSERT INTO provider_settings (id, provider, encrypted_key, enabled, priority, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, provider, encryptedKey, enabledVal, prioVal, nowStr]
    );
  }

  return true;
}

async function getActiveKey(provider) {
  const row = await dbGet('SELECT encrypted_key, enabled FROM provider_settings WHERE provider = ?', [provider]);
  if (row && row.enabled && row.encrypted_key) {
    return decrypt(row.encrypted_key);
  }
  return '';
}

module.exports = {
  getProviderSettings,
  saveProviderSetting,
  getActiveKey
};
