const { dbRun, dbGet, dbAll } = require('../db/db_manager');
const { createProject, updateProject, deleteProject } = require('./project.service');

async function getNodes() {
  return dbAll('SELECT * FROM nodes ORDER BY sort_order ASC');
}

async function getNodeById(id) {
  return dbGet('SELECT * FROM nodes WHERE id = ?', [id]);
}

async function createNode(id, parentId, type, name, context) {
  let projectId = null;
  if (parentId) {
    const parent = await dbGet('SELECT project_id, type FROM nodes WHERE id = ?', [parentId]);
    if (parent) {
      projectId = parent.type === 'project' ? parentId : parent.project_id;
    }
  } else if (type === 'project') {
    projectId = id;
    await createProject(id, name, context);
  }

  await dbRun(
    `INSERT INTO nodes (id, project_id, parent_id, type, name, context, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId, parentId || null, type, name, context || '', new Date().toISOString()]
  );

  return { id, parentId: parentId || null, projectId, name, type, context: context || '' };
}

async function updateNode(id, name, context) {
  const node = await getNodeById(id);
  if (!node) return null;

  await dbRun(
    'UPDATE nodes SET name = COALESCE(?, name), context = COALESCE(?, context), updated_at = ? WHERE id = ?',
    [name, context, new Date().toISOString(), id]
  );

  if (node.type === 'project') {
    await updateProject(id, name, context);
  }

  return { id, name: name || node.name, context: context || node.context };
}

async function deleteNode(id) {
  const node = await getNodeById(id);
  if (!node) return false;

  const idsToDelete = new Set([id]);
  let nodesList = await dbAll('SELECT id, parent_id FROM nodes');
  let added = true;
  while (added) {
    added = false;
    nodesList.forEach(n => {
      if (idsToDelete.has(n.parent_id) && !idsToDelete.has(n.id)) {
        idsToDelete.add(n.id);
        added = true;
      }
    });
  }

  if (node.type === 'project') {
    await deleteProject(id);
  }

  for (const idToDelete of idsToDelete) {
    await dbRun('DELETE FROM nodes WHERE id = ?', [idToDelete]);
  }

  return true;
}

module.exports = {
  getNodes,
  getNodeById,
  createNode,
  updateNode,
  deleteNode
};
