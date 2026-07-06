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
