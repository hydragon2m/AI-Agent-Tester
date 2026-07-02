const { dbRun, dbGet, dbAll } = require('../db/db_manager');

async function createProject(id, name, context) {
  return dbRun(
    'INSERT INTO projects (id, name, context, created_at) VALUES (?, ?, ?, ?)',
    [id, name, context || '', new Date().toISOString()]
  );
}

async function updateProject(id, name, context) {
  return dbRun(
    'UPDATE projects SET name = COALESCE(?, name), context = COALESCE(?, context), updated_at = ? WHERE id = ?',
    [name, context, new Date().toISOString(), id]
  );
}

async function deleteProject(id) {
  return dbRun('DELETE FROM projects WHERE id = ?', [id]);
}

module.exports = {
  createProject,
  updateProject,
  deleteProject
};
