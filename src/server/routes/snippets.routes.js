const express = require('express');
const router = express.Router();
const { getSnippets, saveSnippets } = require('../services/snippet.service');

// Get Snippets
router.get('/', async (req, res) => {
  try {
    const rows = await getSnippets();
    const mapped = rows.map(s => ({
      id: s.id,
      title: s.title,
      content: s.content,
      tags: JSON.parse(s.tags_json || '[]')
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch snippets' });
  }
});

// Save Snippets
router.post('/', async (req, res) => {
  try {
    await saveSnippets(req.body.snippets || []);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save snippets' });
  }
});

module.exports = router;
