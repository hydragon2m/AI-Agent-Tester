const { dbRun, dbGet, dbAll } = require('../db/db_manager');

function mapSystem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
}

async function getSystems() {
  const rows = await dbAll('SELECT * FROM systems ORDER BY created_at ASC');
  return rows.map(mapSystem);
}

async function getSystemById(id) {
  const sys = mapSystem(await dbGet('SELECT * FROM systems WHERE id = ?', [id]));
  if (!sys) return null;

  // Các project thuộc system này (projects.id == node project id == test_strategies.project_id).
  const projects = await dbAll(
    'SELECT id, name FROM projects WHERE system_id = ? ORDER BY created_at ASC',
    [id]
  );

  // Với mỗi project, lấy template + trạng thái test plan từ bản test_strategies mới nhất.
  const enriched = [];
  for (const p of projects) {
    const strat = await dbGet(
      'SELECT template, status FROM test_strategies WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [p.id]
    );
    enriched.push({
      id: p.id,
      name: p.name,
      systemId: id,
      template: strat?.template || '',
      testPlanStatus: strat ? (strat.status || 'draft') : 'none',
    });
  }

  return { ...sys, projects: enriched };
}

async function createSystem({ name, description }) {
  const id = 'sys_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  await dbRun(
    'INSERT INTO systems (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, description || '', now, now]
  );
  return mapSystem(await dbGet('SELECT * FROM systems WHERE id = ?', [id]));
}

async function updateSystem(id, { name, description }) {
  const existing = await dbGet('SELECT * FROM systems WHERE id = ?', [id]);
  if (!existing) return null;
  await dbRun(
    `UPDATE systems SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       updated_at = ?
     WHERE id = ?`,
    [name !== undefined ? name : null, description !== undefined ? description : null, new Date().toISOString(), id]
  );
  return mapSystem(await dbGet('SELECT * FROM systems WHERE id = ?', [id]));
}

// Xóa system: KHÔNG xóa project bên trong — chỉ gỡ liên kết (system_id = NULL) để
// project quay về nhóm "chưa gán" thay vì mất dữ liệu.
async function deleteSystem(id) {
  const existing = await dbGet('SELECT * FROM systems WHERE id = ?', [id]);
  if (!existing) return false;
  await dbRun('UPDATE projects SET system_id = NULL WHERE system_id = ?', [id]);
  await dbRun('DELETE FROM systems WHERE id = ?', [id]);
  return true;
}

module.exports = {
  getSystems,
  getSystemById,
  createSystem,
  updateSystem,
  deleteSystem,
};
