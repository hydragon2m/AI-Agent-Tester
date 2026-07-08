import { requestJson } from './client';

export function fetchTestCases(nodeId) {
  return requestJson(`/testcases/${encodeURIComponent(nodeId)}`);
}

export function saveTestCasesApi(nodeId, testCases) {
  return requestJson(`/testcases/${encodeURIComponent(nodeId)}`, {
    method: 'POST',
    body: JSON.stringify({ testCases, replace: true }),
  });
}

// Fetch every test case within a scope (system | project | module | screen |
// feature), grouped by project. Pure DB read on the server → 0 AI token.
export function exportScopeApi(scopeType, scopeId) {
  return requestJson(`/testcases/export-scope?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`);
}
