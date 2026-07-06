async function callOpenAI(systemPrompt, userContent, key, retryCount = 0, image) {
  const MODELS = ['gpt-4o', 'gpt-4o-mini'];
  const model = MODELS[Math.min(retryCount, MODELS.length - 1)];

  const userMessageContent = image
    ? [
        { type: 'text', text: userContent },
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
      ]
    : userContent;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    const isRetryable = res.status === 429 || errMsg.includes('quota');
    if (isRetryable && retryCount < MODELS.length - 1) {
      console.log(`[OpenAI Provider] Retrying model ${MODELS[retryCount + 1]}...`);
      await new Promise(r => setTimeout(r, 1500));
      return callOpenAI(systemPrompt, userContent, key, retryCount + 1, image);
    }
    throw new Error(isRetryable ? 'QUOTA_EXCEEDED' : errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

module.exports = { callOpenAI };
