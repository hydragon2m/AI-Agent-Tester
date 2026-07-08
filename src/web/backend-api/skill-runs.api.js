import { requestJson } from './client';

export function fetchSkillRuns(nodeId, skill) {
  return requestJson(`/api/skill-runs/${encodeURIComponent(nodeId)}/${encodeURIComponent(skill)}`);
}

export function createSkillRun(payload) {
  return requestJson('/api/skill-runs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function renameSkillRun(id, title) {
  return requestJson(`/api/skill-runs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
}

export function deleteSkillRun(id) {
  return requestJson(`/api/skill-runs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function restoreSkillRun(id) {
  return requestJson(`/api/skill-runs/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}
