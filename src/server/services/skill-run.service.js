const { dbRun, dbGet, dbAll } = require('../db/db_manager');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    nodeId: row.node_id,
    skill: row.skill,
    title: row.title || '',
    input: row.input || '',
    output: row.output_json ? JSON.parse(row.output_json) : null,
    rawOutput: row.raw_output || '',
    provider: row.provider || '',
    createdAt: row.created_at,
  };
}

async function listSkillRuns(nodeId, skill) {
  const rows = await dbAll(
    'SELECT * FROM skill_runs WHERE node_id = ? AND skill = ? ORDER BY created_at DESC',
    [nodeId, skill]
  );
  return rows.map(mapRow);
}

async function createSkillRun({ nodeId, skill, title, input, output, rawOutput, provider }) {
  const id = 'srun_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
  const createdAt = new Date().toISOString();
  await dbRun(
    `INSERT INTO skill_runs (id, node_id, skill, title, input, output_json, raw_output, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nodeId, skill, title || null, input || '', JSON.stringify(output ?? null), rawOutput || '', provider || '', createdAt]
  );
  return mapRow(await dbGet('SELECT * FROM skill_runs WHERE id = ?', [id]));
}

async function renameSkillRun(id, title) {
  const existing = await dbGet('SELECT * FROM skill_runs WHERE id = ?', [id]);
  if (!existing) return null;
  await dbRun('UPDATE skill_runs SET title = ? WHERE id = ?', [title, id]);
  return mapRow(await dbGet('SELECT * FROM skill_runs WHERE id = ?', [id]));
}

async function deleteSkillRun(id) {
  const existing = await dbGet('SELECT * FROM skill_runs WHERE id = ?', [id]);
  if (!existing) return false;
  await dbRun('DELETE FROM skill_runs WHERE id = ?', [id]);
  return true;
}

async function restoreSkillRun(id) {
  const existing = await dbGet('SELECT * FROM skill_runs WHERE id = ?', [id]);
  if (!existing) return null;
  const restoredTitle = `Khôi phục: ${existing.title || new Date(existing.created_at).toLocaleString('vi-VN')}`;
  return createSkillRun({
    nodeId: existing.node_id,
    skill: existing.skill,
    title: restoredTitle,
    input: existing.input,
    output: existing.output_json ? JSON.parse(existing.output_json) : null,
    rawOutput: existing.raw_output,
    provider: existing.provider,
  });
}

module.exports = {
  listSkillRuns,
  createSkillRun,
  renameSkillRun,
  deleteSkillRun,
  restoreSkillRun,
};
