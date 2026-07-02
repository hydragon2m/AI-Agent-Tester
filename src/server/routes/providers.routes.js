const express = require('express');
const router = express.Router();
const { getProviderSettings, saveProviderSetting } = require('../services/provider.service');

// Get all provider settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getProviderSettings();
    res.json(settings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch provider settings' });
  }
});

// Save or update provider settings
router.post('/settings', async (req, res) => {
  const { provider, key, enabled, priority } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }

  try {
    await saveProviderSetting(provider, key, enabled, priority);
    const settings = await getProviderSettings();
    res.json(settings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save provider settings' });
  }
});

module.exports = router;
