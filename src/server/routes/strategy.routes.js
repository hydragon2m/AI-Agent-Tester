const express = require('express');
const router = express.Router();
const {
  getLatestStrategy,
  getStrategyById,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  getReleaseCheck,
} = require('../services/strategy.service');

// Lấy strategy hiện tại (bản mới nhất) của 1 project
router.get('/', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  try {
    const strategy = await getLatestStrategy(projectId);
    res.json(strategy); // có thể null nếu project chưa có strategy nào
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch strategy', message: e.message });
  }
});

// Release check — tiến độ test theo stage của project (đặt TRƯỚC /:id để không bị nuốt route)
router.get('/release-check', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  try {
    const result = await getReleaseCheck(projectId);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to compute release check', message: e.message });
  }
});

// Tạo strategy mới (dùng cho cả lưu nháp lẫn approve — mỗi lần = 1 revision)
router.post('/', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  try {
    const strategy = await createStrategy(req.body);
    res.json(strategy);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create strategy', message: e.message });
  }
});

// Cập nhật toggle/nội dung/approve của 1 strategy đã lưu
router.put('/:id', async (req, res) => {
  try {
    const updated = await updateStrategy(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Strategy not found' });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update strategy', message: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteStrategy(req.params.id);
    if (!success) return res.status(404).json({ error: 'Strategy not found' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete strategy', message: e.message });
  }
});

module.exports = router;
