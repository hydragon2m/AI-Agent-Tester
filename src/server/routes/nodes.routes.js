const express = require('express');
const router = express.Router();
const { getNodes, createNode, updateNode, deleteNode } = require('../services/node.service');

// Get Tree
router.get('/', async (req, res) => {
  try {
    const nodes = await getNodes();
    const mapped = nodes.map(n => ({
      id: n.id,
      parentId: n.parent_id,
      projectId: n.project_id,
      name: n.name,
      type: n.type,
      context: n.context || ''
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch tree' });
  }
});

// Add Node
router.post('/', async (req, res) => {
  const { parentId, name, type, context } = req.body;
  if (!name || !['project', 'module', 'screen', 'feature'].includes(type)) {
    return res.status(400).json({ error: 'Invalid node payload' });
  }
  try {
    const id = 'node_' + Date.now().toString();
    const newNode = await createNode(id, parentId, type, name, context);
    res.json(newNode);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create node' });
  }
});

// Rename Node
router.put('/:id', async (req, res) => {
  const { name, context } = req.body;
  try {
    const updated = await updateNode(req.params.id, name, context);
    if (!updated) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// Delete Node
router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteNode(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

module.exports = router;
