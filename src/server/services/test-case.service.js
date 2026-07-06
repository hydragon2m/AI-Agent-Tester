const { dbRun, dbGet, dbAll } = require('../db/db_manager');
const { getModuleForNode, getDescendantNodeIds } = require('./node.service');

async function getTestCases(nodeId) {
  return dbAll('SELECT * FROM test_cases WHERE node_id = ?', [nodeId]);
}

function sanitizeAbbreviation(name) {
  const letters = String(name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return letters || 'TC';
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

  await assignModuleScopedIds(nodeId, newTCs);

  for (const tc of newTCs) {
    const stepsJson = JSON.stringify(tc.steps || []);
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
              tc.type || 'Positive',
              tc.priority || 'Medium',
              tc.suite || 'Regression',
              tc.automationCandidate || 'Yes',
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
              tc.type || 'Positive',
              tc.priority || 'Medium',
              tc.suite || 'Regression',
              tc.automationCandidate || 'Yes',
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
  }

  return getTestCases(nodeId);
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
  markLarkSynced,
  clearLarkSyncForProject,
  saveTestCases,
  getTestCaseRevisions,
  restoreRevision
};
