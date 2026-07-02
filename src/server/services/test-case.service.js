const { dbRun, dbGet, dbAll } = require('../db/db_manager');

async function getTestCases(nodeId) {
  return dbAll('SELECT * FROM test_cases WHERE node_id = ?', [nodeId]);
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
  saveTestCases,
  getTestCaseRevisions,
  restoreRevision
};
