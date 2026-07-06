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

async function getLarkLink(projectId) {
  const row = await dbGet(
    'SELECT lark_base_app_token, lark_testcase_table_id, lark_bug_table_id, lark_source_url FROM projects WHERE id = ?',
    [projectId]
  );
  if (!row) return null;
  return {
    appToken: row.lark_base_app_token || '',
    testcaseTableId: row.lark_testcase_table_id || '',
    bugTableId: row.lark_bug_table_id || '',
    sourceUrl: row.lark_source_url || ''
  };
}

async function saveLarkLink(projectId, { appToken, testcaseTableId, bugTableId, sourceUrl }) {
  await dbRun(
    `UPDATE projects SET
       lark_base_app_token = ?, lark_testcase_table_id = ?, lark_bug_table_id = ?,
       lark_source_url = ?, updated_at = ?
     WHERE id = ?`,
    [appToken, testcaseTableId, bugTableId, sourceUrl, new Date().toISOString(), projectId]
  );
}

module.exports = {
  createProject,
  updateProject,
  deleteProject,
  getLarkLink,
  saveLarkLink
};
