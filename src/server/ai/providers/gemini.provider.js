async function callGemini(systemPrompt, userContent, key, retryCount = 0, image, expectJson = false) {
  const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];
  const model = MODELS[Math.min(retryCount, MODELS.length - 1)];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const parts = image
    ? [{ inline_data: { mime_type: image.mediaType, data: image.data } }, { text: userContent }]
    : [{ text: userContent }];

  const generationConfig = { temperature: 0.4, maxOutputTokens: 8192 };
  // Ép Gemini trả JSON thuần (không chèn markdown fence/lời dẫn) cho các skill
  // parse JSON ở frontend (testcase, tcquality, srsdecomposer) — Gemini hay lách
  // luật "chỉ trả JSON" trong system prompt nếu không bật cờ này. Các skill này
  // cũng hay bị cắt cụt giữa chừng (JSON.parse lỗi "Unterminated string") ở giới
  // hạn 8192 token khi nội dung dài (ví dụ bóc tách SRS ra nhiều feature) — đã
  // xác nhận qua test thực tế là tăng lên 32768 giải quyết được, nên chỉ áp
  // dụng mức cao hơn này cho các skill JSON, giữ nguyên 8192 cho skill markdown.
  if (expectJson) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.maxOutputTokens = 32768;
  }

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    const isRetryable = res.status === 429 || res.status === 404 || res.status === 503
      || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')
      || errMsg.includes('not found') || errMsg.includes('not supported')
      || errMsg.includes('high demand') || errMsg.includes('overloaded');

    if (isRetryable && retryCount < MODELS.length - 1) {
      console.log(`[Gemini Provider] Retrying model ${MODELS[retryCount + 1]}...`);
      await new Promise(r => setTimeout(r, 1500));
      return callGemini(systemPrompt, userContent, key, retryCount + 1, image, expectJson);
    }
    const isQuota = res.status === 429 || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    throw new Error(isQuota ? 'QUOTA_EXCEEDED' : errMsg);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = { callGemini };
