export function parseAiJson(output) {
  const text = String(output || '').trim();
  
  // 1. Try to parse directly first if it starts with [ or { (valid JSON starts)
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Fall through to regex matching if direct parse fails
    }
  }

  // 2. Try to match code fences
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      // Fall through to parsing text directly
    }
  }

  return JSON.parse(text);
}

export function stripCodeFence(text) {
  return String(text || '').replace(/^```[\w-]*\s*/i, '').replace(/```$/i, '').trim();
}
