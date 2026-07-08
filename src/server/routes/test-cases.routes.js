const express = require('express');
const router = express.Router();
const { getTestCases, saveTestCases, getTestCasesForScope } = require('../services/test-case.service');

function mapTcRow(tc) {
  return {
    id: tc.id,
    nodeId: tc.node_id,
    externalId: tc.external_id,
    module: tc.module,
    name: tc.name,
    type: tc.type,
    priority: tc.priority,
    suite: tc.suite,
    automationCandidate: tc.automation_candidate,
    traceTo: tc.trace_to,
    preconditions: tc.preconditions,
    steps: JSON.parse(tc.steps_json || '[]'),
    testData: tc.test_data,
    expectedResult: tc.expected_result,
    status: tc.status,
    actualResult: tc.actual_result,
    relatedBug: tc.related_bug,
    version: tc.version,
    nodePath: tc._path || { module: '', screen: '', feature: '' }
  };
}

// Export a whole SCOPE (system/project/module/screen/feature) as test cases
// grouped by project. MUST stay ABOVE '/:nodeId' — otherwise Express matches
// this path as GET /:nodeId with nodeId="export-scope". Pure DB → 0 AI token.
router.get('/export-scope', async (req, res) => {
  const { scopeType, scopeId } = req.query;
  if (!scopeType || !scopeId) {
    return res.status(400).json({ error: 'scopeType và scopeId là bắt buộc' });
  }
  try {
    const { scopeName, groups } = await getTestCasesForScope(scopeType, scopeId);
    res.json({
      scopeType,
      scopeName,
      groups: groups.map(g => ({
        projectId: g.projectId,
        projectName: g.projectName,
        testCases: g.rows.map(mapTcRow)
      }))
    });
  } catch (e) {
    console.error('export-scope failed:', e);
    res.status(500).json({ error: e.message || 'Export scope thất bại' });
  }
});

// Get Test Cases
router.get('/:nodeId', async (req, res) => {
  try {
    const rows = await getTestCases(req.params.nodeId);
    const mapped = rows.map(tc => ({
      id: tc.id,
      nodeId: tc.node_id,
      externalId: tc.external_id,
      module: tc.module,
      name: tc.name,
      type: tc.type,
      priority: tc.priority,
      suite: tc.suite,
      automationCandidate: tc.automation_candidate,
      traceTo: tc.trace_to,
      preconditions: tc.preconditions,
      steps: JSON.parse(tc.steps_json || '[]'),
      testData: tc.test_data,
      expectedResult: tc.expected_result,
      status: tc.status,
      actualResult: tc.actual_result,
      relatedBug: tc.related_bug,
      version: tc.version
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
});

// Save Test Cases
router.post('/:nodeId', async (req, res) => {
  const nodeId = req.params.nodeId;
  if (!Array.isArray(req.body.testCases)) {
    return res.status(400).json({ error: 'testCases must be an array' });
  }
  try {
    const saved = await saveTestCases(nodeId, req.body.testCases, req.body.replace);
    const mapped = saved.map(tc => ({
      id: tc.id,
      nodeId: tc.node_id,
      externalId: tc.external_id,
      module: tc.module,
      name: tc.name,
      type: tc.type,
      priority: tc.priority,
      suite: tc.suite,
      automationCandidate: tc.automation_candidate,
      traceTo: tc.trace_to,
      preconditions: tc.preconditions,
      steps: JSON.parse(tc.steps_json || '[]'),
      testData: tc.test_data,
      expectedResult: tc.expected_result,
      status: tc.status,
      actualResult: tc.actual_result,
      relatedBug: tc.related_bug,
      version: tc.version
    }));
    res.json(mapped);
  } catch (e) {
    console.error('Failed to save test cases:', e);
    res.status(500).json({ error: e.message || 'Failed to save test cases', details: e.stack || '' });
  }
});

const { getTestCaseRevisions, restoreRevision } = require('../services/test-case.service');

// Get Test Case revisions
router.get('/:id/revisions', async (req, res) => {
  try {
    const revisions = await getTestCaseRevisions(req.params.id);
    const mapped = revisions.map(r => ({
      id: r.id,
      testCaseId: r.test_case_id,
      version: r.version,
      changeType: r.change_type,
      name: r.name,
      type: r.type,
      priority: r.priority,
      preconditions: r.preconditions,
      steps: JSON.parse(r.steps_json || '[]'),
      expectedResult: r.expected_result,
      testData: r.test_data,
      updatedAt: r.updated_at
    }));
    res.json(mapped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch test case revisions' });
  }
});

// Restore specific version
router.post('/:id/revisions/:version/restore', async (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    await restoreRevision(req.params.id, version);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to restore test case revision' });
  }
});

module.exports = router;
