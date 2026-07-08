const { dbRun, dbGet, dbAll } = require('../db/db_manager');
const { getModuleForNode, getDescendantNodeIds } = require('./node.service');

async function getTestCases(nodeId) {
  return dbAll('SELECT * FROM test_cases WHERE node_id = ?', [nodeId]);
}

function sanitizeAbbreviation(name) {
  const letters = String(name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return letters || 'TC';
}

const TYPE_MAP = {
  positive: 'Positive',
  negative: 'Negative',
  boundary: 'Boundary',
  'edge case': 'Edge Case',
  edge: 'Edge Case',
  security: 'Security',
  'ui/ux': 'UI/UX',
  uiux: 'UI/UX',
  ui: 'UI/UX',
};
const PRIORITY_MAP = {
  high: 'High',
  medium: 'Medium',
  med: 'Medium',
  low: 'Low',
};
const SUITE_MAP = {
  smoke: 'Smoke',
  regression: 'Regression',
  'new feature': 'New Feature',
  exploratory: 'Exploratory',
  'new-feature': 'New Feature',
};
const AUTOMATION_MAP = {
  yes: 'Yes',
  no: 'No',
};

function normalizeEnum(value, map, defaultValue) {
  if (typeof value !== 'string') return defaultValue;
  const key = value.trim().toLowerCase();
  return map[key] || defaultValue;
}

function normalizeString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function normalizeSteps(steps) {
  if (Array.isArray(steps)) return steps.map(item => normalizeString(item));
  if (steps == null) return [];
  const text = typeof steps === 'string' ? steps : String(steps);
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*\d+[.)]?\s*/, '').trim())
    .filter(line => line.length > 0);
}

function normalizeTestCase(tc) {
  if (!tc || typeof tc !== 'object') return { steps: [] };
  return {
    id: normalizeString(tc.id),
    externalId: normalizeString(tc.externalId) || null,
    module: normalizeString(tc.module),
    name: normalizeString(tc.name),
    type: normalizeEnum(tc.type, TYPE_MAP, 'Positive'),
    priority: normalizeEnum(tc.priority, PRIORITY_MAP, 'Medium'),
    suite: normalizeEnum(tc.suite, SUITE_MAP, 'Regression'),
    automationCandidate: normalizeEnum(tc.automationCandidate, AUTOMATION_MAP, 'Yes'),
    traceTo: normalizeString(tc.traceTo),
    preconditions: normalizeString(tc.preconditions),
    steps: normalizeSteps(tc.steps),
    testData: normalizeString(tc.testData),
    expectedResult: normalizeString(tc.expectedResult),
    status: normalizeString(tc.status),
    actualResult: normalizeString(tc.actualResult),
    relatedBug: normalizeString(tc.relatedBug),
  };
}

// Scopes TC ID numbering to the module a node belongs to: same prefix, one
// shared counter across every screen/feature under that module, so IDs never
// collide within the module even when generated from different features.
async function getModuleIdScope(nodeId) {
  const moduleNode = await getModuleForNode(nodeId);
  const abbreviation = (moduleNode?.abbreviation || '').trim().toUpperCase() || sanitizeAbbreviation(moduleNode?.name);
  const scopeNodeIds = moduleNode ? await getDescendantNodeIds(moduleNode.id) : [nodeId];
  const placeholders = scopeNodeIds.map(() => '?').join(',');
  const rows = scopeNodeIds.length
    ? await dbAll(`SELECT id FROM test_cases WHERE node_id IN (${placeholders})`, scopeNodeIds)
    : [];

  const existingIds = new Set(rows.map(r => r.id));
  const prefix = `${abbreviation}-`;
  let maxNumber = 0;
  for (const id of existingIds) {
    if (id && id.toUpperCase().startsWith(prefix)) {
      const n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n)) maxNumber = Math.max(maxNumber, n);
    }
  }

  return { prefix, nextNumber: maxNumber + 1, existingIds };
}

// Server-side guarantee: every saved TC gets an id in "{ModuleAbbrev}-000"
// format, unique within its module. IDs the caller (AI output / import) sent
// are kept as-is when they already match and don't collide; anything missing,
// malformed, or duplicated within the module gets renumbered here.
async function assignModuleScopedIds(nodeId, testCases) {
  const { prefix, nextNumber, existingIds } = await getModuleIdScope(nodeId);
  const idPattern = new RegExp(`^${prefix}\\d+$`, 'i');
  let counter = nextNumber;

  for (const tc of testCases) {
    const isNewRow = !tc.id || !(await dbGet('SELECT 1 FROM test_cases WHERE id = ?', [tc.id]));
    if (!isNewRow) continue; // updating an existing TC keeps its current id

    const isValid = tc.id && idPattern.test(tc.id) && !existingIds.has(tc.id);
    if (!isValid) {
      let candidate;
      do {
        candidate = `${prefix}${String(counter).padStart(3, '0')}`;
        counter++;
      } while (existingIds.has(candidate));
      tc.id = candidate;
    }
    existingIds.add(tc.id);
  }
}

async function getTestCasesByStatus(nodeId, statusLabel) {
  return dbAll(
    'SELECT * FROM test_cases WHERE node_id = ? AND LOWER(TRIM(status)) = LOWER(TRIM(?))',
    [nodeId, statusLabel]
  );
}

async function markLarkSynced(testCaseId, larkRecordId) {
  await dbRun(
    'UPDATE test_cases SET lark_record_id = ?, lark_synced_at = ? WHERE id = ?',
    [larkRecordId, new Date().toISOString(), testCaseId]
  );
}

// Old record IDs point at whatever Base was linked before — once the project
// links a different Base those IDs are meaningless, and pushing them as an
// update instead of a create fails outright (record doesn't exist there).
async function clearLarkSyncForProject(projectId) {
  const result = await dbRun(
    `UPDATE test_cases SET lark_record_id = '', lark_synced_at = NULL
     WHERE node_id IN (SELECT id FROM nodes WHERE project_id = ?)`,
    [projectId]
  );
  return result.changes;
}

async function saveTestCases(nodeId, newTCs, replace = false) {
  if (replace) {
    const keepIds = newTCs.map(tc => tc.id).filter(Boolean);
    if (keepIds.length > 0) {
      const placeholders = keepIds.map(() => '?').join(',');
      await dbRun(`DELETE FROM test_cases WHERE node_id = ? AND id NOT IN (${placeholders})`, [nodeId, ...keepIds]);
    } else {
      await dbRun(`DELETE FROM test_cases WHERE node_id = ?`, [nodeId]);
    }
  }

  const normalizedTCs = newTCs.map(normalizeTestCase);
  await assignModuleScopedIds(nodeId, normalizedTCs);

  for (const tc of normalizedTCs) {
    const normalizedSteps = normalizeSteps(tc.steps);
    const stepsJson = JSON.stringify(normalizedSteps);
    const nowStr = new Date().toISOString();

    const existing = await dbGet('SELECT * FROM test_cases WHERE id = ?', [tc.id]);
    if (existing) {
      const isChanged = 
          existing.name !== tc.name ||
          existing.type !== tc.type ||
          existing.priority !== tc.priority ||
          existing.preconditions !== tc.preconditions ||
          existing.steps_json !== stepsJson ||
          existing.expected_result !== tc.expectedResult ||
          existing.test_data !== tc.testData;

      const newVersion = isChanged ? existing.version + 1 : existing.version;

      await dbRun(
          `UPDATE test_cases SET 
              node_id = ?, external_id = ?, module = ?, name = ?, type = ?, 
              priority = ?, suite = ?, automation_candidate = ?, trace_to = ?, 
              preconditions = ?, steps_json = ?, test_data = ?, expected_result = ?, 
              status = ?, actual_result = ?, related_bug = ?, version = ?, updated_at = ? 
           WHERE id = ?`,
          [
              nodeId,
              tc.externalId || null,
              tc.module || '',
              tc.name,
              tc.type,
              tc.priority,
              tc.suite,
              tc.automationCandidate,
              tc.traceTo || '',
              tc.preconditions || '',
              stepsJson,
              tc.testData || '',
              tc.expectedResult || '',
              tc.status || '',
              tc.actualResult || '',
              tc.relatedBug || '',
              newVersion,
              nowStr,
              tc.id
          ]
      );

      if (isChanged) {
        await dbRun(
            `INSERT INTO test_case_revisions (
                test_case_id, version, change_type, name, type, priority, 
                preconditions, steps_json, expected_result, test_data, updated_at
            ) VALUES (?, ?, 'updated', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tc.id,
                newVersion,
                tc.name,
                tc.type || 'Positive',
                tc.priority || 'Medium',
                tc.preconditions || '',
                stepsJson,
                tc.expectedResult || '',
                tc.testData || '',
                nowStr
            ]
        );
      }
    } else {
      await dbRun(
          `INSERT INTO test_cases (
              id, node_id, external_id, module, name, type, priority, suite, 
              automation_candidate, trace_to, preconditions, steps_json, 
              test_data, expected_result, status, actual_result, related_bug, version, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
              tc.id,
              nodeId,
              tc.externalId || null,
              tc.module || '',
              tc.name,
              tc.type,
              tc.priority,
              tc.suite,
              tc.automationCandidate,
              tc.traceTo || '',
              tc.preconditions || '',
              stepsJson,
              tc.testData || '',
              tc.expectedResult || '',
              tc.status || '',
              tc.actualResult || '',
              tc.relatedBug || '',
              nowStr
          ]
      );

      await dbRun(
          `INSERT INTO test_case_revisions (
              test_case_id, version, change_type, name, type, priority, 
              preconditions, steps_json, expected_result, test_data, updated_at
          ) VALUES (?, 1, 'created', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
              tc.id,
              tc.name,
              tc.type,
              tc.priority,
              tc.preconditions || '',
              stepsJson,
              tc.expectedResult || '',
              tc.testData || '',
              nowStr
          ]
      );
    }
  }

  return getTestCases(nodeId);
}

// Collects test cases for an export/push SCOPE (system | project | module |
// screen | feature). Always returns rows grouped by owning project — one group
// for a single-node scope, one group per project for a system — so callers can
// either flatten them (CSV) or fan out to one Lark table per project. Each row
// is the raw test_cases row annotated with `_path` (module/screen/feature names
// walked up the tree) for column filling. Pure DB read → 0 AI token.
async function getTestCasesForScope(scopeType, scopeId) {
  const allNodes = await dbAll('SELECT id, parent_id, type, name, project_id FROM nodes');
  const nodeById = new Map(allNodes.map(n => [n.id, n]));

  // itself + every descendant (BFS in memory, same approach as getDescendantNodeIds)
  function descendantsOf(rootId) {
    const ids = new Set([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const n of allNodes) {
        if (ids.has(n.parent_id) && !ids.has(n.id)) { ids.add(n.id); added = true; }
      }
    }
    return Array.from(ids);
  }
  function pathFor(nodeId) {
    const p = { module: '', screen: '', feature: '' };
    let cur = nodeById.get(nodeId);
    while (cur) {
      if (cur.type === 'module' && !p.module) p.module = cur.name;
      else if (cur.type === 'screen' && !p.screen) p.screen = cur.name;
      else if (cur.type === 'feature' && !p.feature) p.feature = cur.name;
      cur = cur.parent_id ? nodeById.get(cur.parent_id) : null;
    }
    return p;
  }
  async function rowsForNodeIds(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await dbAll(`SELECT * FROM test_cases WHERE node_id IN (${placeholders})`, ids);
    return rows.map(r => ({ ...r, _path: pathFor(r.node_id) }));
  }

  const groups = [];
  let scopeName = '';

  if (scopeType === 'system') {
    const sys = await dbGet('SELECT name FROM systems WHERE id = ?', [scopeId]);
    scopeName = sys?.name || 'System';
    const projects = await dbAll(
      'SELECT id, name FROM projects WHERE system_id = ? ORDER BY created_at ASC',
      [scopeId]
    );
    for (const p of projects) {
      const rows = await rowsForNodeIds(descendantsOf(p.id));
      groups.push({ projectId: p.id, projectName: p.name || 'Project', rows });
    }
  } else {
    // scopeId is a node id. Group under its owning project (project node id === projects.id).
    const rootNode = nodeById.get(scopeId);
    scopeName = rootNode?.name || 'Scope';
    const projectId = rootNode ? (rootNode.type === 'project' ? rootNode.id : rootNode.project_id) : null;
    let projectName = rootNode?.name || 'Project';
    if (projectId) {
      const projRow = await dbGet('SELECT name FROM projects WHERE id = ?', [projectId]);
      if (projRow?.name) projectName = projRow.name;
    }
    const rows = await rowsForNodeIds(descendantsOf(scopeId));
    groups.push({ projectId: projectId || null, projectName, rows });
  }

  return { scopeType, scopeName, groups };
}

async function getTestCaseRevisions(testCaseId) {
  return dbAll('SELECT * FROM test_case_revisions WHERE test_case_id = ? ORDER BY version DESC', [testCaseId]);
}

async function restoreRevision(testCaseId, version) {
  const rev = await dbGet('SELECT * FROM test_case_revisions WHERE test_case_id = ? AND version = ?', [testCaseId, version]);
  if (!rev) throw new Error('Revision not found');

  const nowStr = new Date().toISOString();
  const tc = await dbGet('SELECT version FROM test_cases WHERE id = ?', [testCaseId]);
  if (!tc) throw new Error('Test case not found');

  const nextVersion = tc.version + 1;

  await dbRun(
    `UPDATE test_cases SET 
       name = ?, type = ?, priority = ?, preconditions = ?, steps_json = ?, 
       expected_result = ?, test_data = ?, version = ?, updated_at = ? 
     WHERE id = ?`,
    [
      rev.name,
      rev.type,
      rev.priority,
      rev.preconditions,
      rev.steps_json,
      rev.expected_result,
      rev.test_data,
      nextVersion,
      nowStr,
      testCaseId
    ]
  );

  // Log new revision for the restore action
  await dbRun(
    `INSERT INTO test_case_revisions (
       test_case_id, version, change_type, name, type, priority, 
       preconditions, steps_json, expected_result, test_data, updated_at
     ) VALUES (?, ?, 'restored', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testCaseId,
      nextVersion,
      rev.name,
      rev.type,
      rev.priority,
      rev.preconditions,
      rev.steps_json,
      rev.expected_result,
      rev.test_data,
      nowStr
    ]
  );

  return true;
}

module.exports = {
  getTestCases,
  getTestCasesByStatus,
  getTestCasesForScope,
  markLarkSynced,
  clearLarkSyncForProject,
  saveTestCases,
  getTestCaseRevisions,
  restoreRevision
};
