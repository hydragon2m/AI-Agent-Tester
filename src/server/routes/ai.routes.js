const express = require('express');
const router = express.Router();
const { callAI } = require('../services/ai-router.service');
const { dbRun } = require('../db/db_manager');

const { getActiveKey } = require('../services/provider.service');

// AI Status
router.get('/status', async (req, res) => {
  const dbGemini = await getActiveKey('gemini');
  const dbClaude = await getActiveKey('claude');
  const dbOpenai = await getActiveKey('openai');

  res.json({
    gemini: { enabled: !!(dbGemini || process.env.GEMINI_API_KEY) },
    claude: { enabled: !!(dbClaude || process.env.CLAUDE_API_KEY) },
    openai: { enabled: !!(dbOpenai || process.env.OPENAI_API_KEY) }
  });
});

// AI Generate
router.post('/generate', async (req, res) => {
  const { skill, systemPrompt, userPrompt, nodeId, image } = req.body;
  if (!skill || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing required parameters: skill, systemPrompt, userPrompt' });
  }

  try {
    const result = await callAI(systemPrompt, userPrompt, image);
    
    // Log Run to DB
    await dbRun(
      `INSERT INTO ai_runs (id, node_id, skill, provider, prompt, output, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['run_' + Date.now().toString(), nodeId || null, skill, result.provider, userPrompt, result.output, new Date().toISOString()]
    );

    res.json({
      provider: result.provider,
      output: result.output
    });
  } catch (e) {
    console.error('AI Generation Error:', e);
    if (e.message === 'NO_API_KEYS_ON_SERVER') {
      res.status(500).json({ error: 'NO_API_KEYS_ON_SERVER', message: 'No API keys configured on the server. Please set them in the .env file.' });
    } else {
      res.status(500).json({ error: e.message || 'AI_GENERATION_FAILED', message: e.message });
    }
  }
});

module.exports = router;
