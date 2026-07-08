const express = require('express');
const router = express.Router();
const {
  getSystems,
  getSystemById,
  createSystem,
  updateSystem,
  deleteSystem,
} = require('../services/systems.service');

// Danh sách tất cả systems
router.get('/', async (req, res) => {
  try {
    const systems = await getSystems();
    res.json(systems);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch systems', message: e.message });
  }
});

// Chi tiết 1 system + danh sách project thuộc system (kèm template + trạng thái test plan)
router.get('/:id', async (req, res) => {
  try {
    const system = await getSystemById(req.params.id);
    if (!system) return res.status(404).json({ error: 'System not found' });
    res.json(system);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch system', message: e.message });
  }
});

// Tạo system mới
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const system = await createSystem(req.body);
    res.json(system);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create system', message: e.message });
  }
});

// Cập nhật tên/mô tả system
router.put('/:id', async (req, res) => {
  try {
    const updated = await updateSystem(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'System not found' });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update system', message: e.message });
  }
});

// Xóa system (project bên trong được gỡ liên kết, không bị xóa)
router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteSystem(req.params.id);
    if (!success) return res.status(404).json({ error: 'System not found' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete system', message: e.message });
  }
});

module.exports = router;
