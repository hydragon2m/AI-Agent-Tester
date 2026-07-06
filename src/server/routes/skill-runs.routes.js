const express = require('express');
const router = express.Router();
const {
  listSkillRuns,
  createSkillRun,
  renameSkillRun,
  deleteSkillRun,
  restoreSkillRun,
} = require('../services/skill-run.service');

// List history for a node + skill
router.get('/:nodeId/:skill', async (req, res) => {
  try {
    const runs = await listSkillRuns(req.params.nodeId, req.params.skill);
    res.json(runs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch skill history' });
  }
});

// Save a new execution result
router.post('/', async (req, res) => {
  const { nodeId, skill, title, input, output, rawOutput, provider } = req.body;
  if (!nodeId || !skill) {
    return res.status(400).json({ error: 'Missing required parameters: nodeId, skill' });
  }
  try {
    const run = await createSkillRun({ nodeId, skill, title, input, output, rawOutput, provider });
    res.json(run);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save skill run' });
  }
});

// Rename a history entry
router.put('/:id', async (req, res) => {
  try {
    const updated = await renameSkillRun(req.params.id, req.body.title || '');
    if (!updated) return res.status(404).json({ error: 'Skill run not found' });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to rename skill run' });
  }
});

// Delete a history entry
router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteSkillRun(req.params.id);
    if (!success) return res.status(404).json({ error: 'Skill run not found' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete skill run' });
  }
});

// Restore an old version as the newest current entry
router.post('/:id/restore', async (req, res) => {
  try {
    const run = await restoreSkillRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Skill run not found' });
    res.json(run);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to restore skill run' });
  }
});

module.exports = router;
