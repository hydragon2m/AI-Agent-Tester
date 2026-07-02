async function callGemini(systemPrompt, userContent, key, retryCount = 0) {
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
  const model = MODELS[Math.min(retryCount, MODELS.length - 1)];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    const isRetryable = res.status === 429 || res.status === 404
      || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')
      || errMsg.includes('not found') || errMsg.includes('not supported');

    if (isRetryable && retryCount < MODELS.length - 1) {
      console.log(`[Gemini Provider] Retrying model ${MODELS[retryCount + 1]}...`);
      await new Promise(r => setTimeout(r, 1500));
      return callGemini(systemPrompt, userContent, key, retryCount + 1);
    }
    const isQuota = res.status === 429 || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    throw new Error(isQuota ? 'QUOTA_EXCEEDED' : errMsg);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = { callGemini };
