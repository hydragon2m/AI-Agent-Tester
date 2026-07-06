export function parseAiJson(output) {
  const text = String(output || '').trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1] : text);
}

export function stripCodeFence(text) {
  return String(text || '').replace(/^```[\w-]*\s*/i, '').replace(/```$/i, '').trim();
}
