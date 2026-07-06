import { requestJson } from './client';

export function generateAiOutput(payload) {
  return requestJson('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
