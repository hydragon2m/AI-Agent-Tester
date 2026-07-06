const { dbRun, dbGet, dbAll } = require('../db/db_manager');
const { createProject, updateProject, deleteProject } = require('./project.service');

async function getNodes() {
  return dbAll('SELECT * FROM nodes ORDER BY sort_order ASC');
}

async function getNodeById(id) {
  return dbGet('SELECT * FROM nodes WHERE id = ?', [id]);
}

async function createNode(id, parentId, type, name, context, abbreviation) {
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
    `INSERT INTO nodes (id, project_id, parent_id, type, name, context, abbreviation, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId, parentId || null, type, name, context || '', abbreviation || '', new Date().toISOString()]
  );

  return { id, parentId: parentId || null, projectId, name, type, context: context || '', abbreviation: abbreviation || '' };
}

async function updateNode(id, name, context, abbreviation) {
  const node = await getNodeById(id);
  if (!node) return null;

  await dbRun(
    'UPDATE nodes SET name = COALESCE(?, name), context = COALESCE(?, context), abbreviation = COALESCE(?, abbreviation), updated_at = ? WHERE id = ?',
    [name, context, abbreviation, new Date().toISOString(), id]
  );

  if (node.type === 'project') {
    await updateProject(id, name, context);
  }

  return { id, name: name || node.name, context: context || node.context, abbreviation: abbreviation !== undefined ? abbreviation : node.abbreviation };
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

async function getNodePath(nodeId) {
  const path = { module: '', moduleAbbreviation: '', screen: '', feature: '' };
  let current = await getNodeById(nodeId);
  while (current) {
    if (current.type === 'module') {
      path.module = current.name;
      path.moduleAbbreviation = current.abbreviation || '';
    }
    if (current.type === 'screen') path.screen = current.name;
    if (current.type === 'feature') path.feature = current.name;
    current = current.parent_id ? await getNodeById(current.parent_id) : null;
  }
  return path;
}

// Walks up the tree from any node to find its nearest ancestor of type 'module'
// (or itself, if it is one) — used to scope TC ID numbering per module.
async function getModuleForNode(nodeId) {
  let current = await getNodeById(nodeId);
  while (current) {
    if (current.type === 'module') return current;
    current = current.parent_id ? await getNodeById(current.parent_id) : null;
  }
  return null;
}

// All node IDs at or below `nodeId` (itself + every descendant), used to scope
// a module-wide query (screens/features under it) without a recursive SQL CTE.
async function getDescendantNodeIds(nodeId) {
  const all = await dbAll('SELECT id, parent_id FROM nodes');
  const ids = new Set([nodeId]);
  let added = true;
  while (added) {
    added = false;
    for (const n of all) {
      if (ids.has(n.parent_id) && !ids.has(n.id)) {
        ids.add(n.id);
        added = true;
      }
    }
  }
  return Array.from(ids);
}

module.exports = {
  getNodes,
  getNodeById,
  getNodePath,
  getModuleForNode,
  getDescendantNodeIds,
  createNode,
  updateNode,
  deleteNode
};
