async function callGemini(systemPrompt, userContent, key, retryCount = 0, image, expectJson = false) {
  // Nhiều model fallback: nếu 1 model quá tải/không có, thử model kế. Các model
  // khác nhau thường có capacity riêng nên đổi model giúp né spike "high demand".
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  const parts = image
    ? [{ inline_data: { mime_type: image.mediaType, data: image.data } }, { text: userContent }]
    : [{ text: userContent }];

  const generationConfig = { temperature: 0.4, maxOutputTokens: 8192 };
  // Ép Gemini trả JSON thuần (không chèn markdown fence/lời dẫn) cho các skill
  // parse JSON ở frontend (testcase, tcquality, srsdecomposer) — Gemini hay lách
  // luật "chỉ trả JSON" trong system prompt nếu không bật cờ này. Các skill này
  // cũng hay bị cắt cụt giữa chừng (JSON.parse lỗi "Unterminated string") ở giới
  // hạn 8192 token khi nội dung dài → tăng lên 32768 cho nhánh JSON.
  if (expectJson) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.maxOutputTokens = 32768;
  }

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MAX_ATTEMPTS_PER_MODEL = 3; // "high demand" là spike TẠM THỜI → thử lại cùng model sau backoff
  let lastMsg = '';

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const err = await res.json().catch(() => ({}));
      const errMsg = err?.error?.message || `HTTP ${res.status}`;
      lastMsg = errMsg;

      const isQuota = res.status === 429 || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
      const isTransient = res.status === 503 || errMsg.includes('high demand')
        || errMsg.includes('overloaded') || errMsg.includes('UNAVAILABLE');

      // Hết quota: retry cùng key vô ích (quota tính theo key, không theo model)
      // → báo ngay để AI router thử provider khác (nếu có cấu hình).
      if (isQuota) throw new Error('QUOTA_EXCEEDED');

      // Quá tải tạm thời: chờ backoff rồi thử LẠI cùng model (spike thường rất ngắn).
      if (isTransient && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
        const waitMs = 1500 * Math.pow(2, attempt); // 1.5s → 3s
        console.log(`[Gemini Provider] ${model} quá tải, thử lại sau ${waitMs}ms (lần ${attempt + 1})...`);
        await sleep(waitMs);
        continue;
      }

      // Model lỗi/không hỗ trợ, hoặc đã hết lượt retry transient → sang model kế.
      console.log(`[Gemini Provider] ${model} thất bại (${errMsg.slice(0, 60)}), chuyển model kế tiếp...`);
      break;
    }
  }

  // Đã thử hết model mà vẫn quá tải → ném lỗi cuối để router fallback provider khác.
  throw new Error(lastMsg || 'Gemini generation failed');
}

module.exports = { callGemini };
