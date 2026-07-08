const express = require('express');
const router = express.Router();
const { getConfig, saveConfig, testConnection, linkProject, getProjectLink, pushTestCases, pushTestCasesScope } = require('../services/lark.service');

// Get current Lark config (secret is never sent back to the client)
router.get('/config', async (req, res) => {
  try {
    const config = (await getConfig()) || {};
    const { app_secret, ...safeConfig } = config;
    res.json({ ...safeConfig, hasSecret: !!app_secret });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch Lark config' });
  }
});

// Save Lark config. app_secret is optional on update: omit it to keep the
// previously saved secret (same convention as /api/providers/settings).
router.post('/config', async (req, res) => {
  const { app_id, app_secret, approved_status_label } = req.body;
  try {
    const existing = (await getConfig()) || {};
    const patch = {
      app_id: app_id !== undefined ? app_id : existing.app_id,
      approved_status_label: approved_status_label !== undefined ? approved_status_label : existing.approved_status_label
    };
    if (app_secret && app_secret.trim().length > 0) {
      patch.app_secret = app_secret.trim();
    }
    const saved = await saveConfig(patch);
    const { app_secret: _secret, ...safeConfig } = saved;
    res.json({ ...safeConfig, hasSecret: !!saved.app_secret });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save Lark config' });
  }
});

// Verify app_id/app_secret can obtain a tenant_access_token
router.post('/test-connection', async (req, res) => {
  try {
    const config = await getConfig();
    if (!config || !config.app_id || !config.app_secret) {
      return res.status(400).json({ error: 'Chưa có App ID/Secret đã lưu' });
    }
    await testConnection(config);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Kết nối Lark thất bại' });
  }
});

// Fetch the Lark Base link already saved for the project owning this node,
// so the frontend can pre-fill the link popup instead of starting blank.
router.get('/link', async (req, res) => {
  const { node_id } = req.query;
  if (!node_id) {
    return res.status(400).json({ error: 'node_id is required' });
  }
  try {
    const link = await getProjectLink(node_id);
    res.json(link || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch Lark link' });
  }
});

// Assign a Lark Base (or Wiki-embedded Base) link to the project that owns
// this node, creating/reconciling the Test Cases + Bugs tables inside it.
router.post('/link', async (req, res) => {
  const { node_id, url } = req.body;
  if (!node_id || !url) {
    return res.status(400).json({ error: 'node_id và url là bắt buộc' });
  }
  try {
    const summary = await linkProject(node_id, url);
    res.json(summary);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Gán link Lark thất bại' });
  }
});

// Push approved test cases for a node to its project's linked Lark Base
router.post('/push', async (req, res) => {
  const { node_id } = req.body;
  if (!node_id) {
    return res.status(400).json({ error: 'node_id is required' });
  }
  try {
    const summary = await pushTestCases(node_id);
    res.json(summary);
  } catch (e) {
    console.error(e);
    if (e.code === 'NOT_LINKED') {
      return res.status(409).json({ error: 'NOT_LINKED', message: e.message });
    }
    res.status(400).json({ error: e.message || 'Đẩy lên Lark thất bại' });
  }
});

// Push a whole SCOPE (system/project/module/screen/feature) to a Lark Base
// given by URL, one table per project. Body: { scopeType, scopeId, url, saveLink }.
router.post('/push-scope', async (req, res) => {
  const { scopeType, scopeId, url, saveLink } = req.body;
  if (!scopeType || !scopeId || !url) {
    return res.status(400).json({ error: 'scopeType, scopeId và url là bắt buộc' });
  }
  try {
    const result = await pushTestCasesScope(scopeType, scopeId, url, !!saveLink);
    res.json(result);
  } catch (e) {
    console.error('push-scope failed:', e);
    res.status(400).json({ error: e.message || 'Đẩy scope lên Lark thất bại' });
  }
});

module.exports = router;
