// Gọi Gemini cho 1 key duy nhất: fallback qua nhiều model + retry backoff khi
// gặp "high demand"/503 (spike tạm thời). Quota (429/RESOURCE_EXHAUSTED) ném
// QUOTA_EXCEEDED ngay để lớp trên xoay key / fallback provider.
async function callGeminiSingle(systemPrompt, userContent, key, image, expectJson) {
  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  const parts = image
    ? [{ inline_data: { mime_type: image.mediaType, data: image.data } }, { text: userContent }]
    : [{ text: userContent }];

  const generationConfig = { temperature: 0.4, maxOutputTokens: 8192 };
  // Ép Gemini trả JSON thuần cho các skill parse JSON ở frontend + nới token cho
  // nhánh JSON (nội dung dài hay bị cắt cụt ở 8192 → dùng 32768).
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

      // Hết quota: retry cùng key vô ích (quota tính theo key) → ném ngay để xoay key/provider.
      if (isQuota) throw new Error('QUOTA_EXCEEDED');

      // Quá tải tạm thời: chờ backoff rồi thử LẠI cùng model.
      if (isTransient && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
        const waitMs = 1500 * Math.pow(2, attempt); // 1.5s → 3s
        console.log(`[Gemini Provider] ${model} quá tải, thử lại sau ${waitMs}ms (lần ${attempt + 1})...`);
        await sleep(waitMs);
        continue;
      }

      // Model lỗi/không hỗ trợ, hoặc hết lượt retry transient → sang model kế.
      console.log(`[Gemini Provider] ${model} thất bại (${errMsg.slice(0, 60)}), chuyển model kế tiếp...`);
      break;
    }
  }

  const e = new Error(lastMsg || 'Gemini generation failed');
  e.geminiOverloaded = /high demand|overloaded|UNAVAILABLE|503/i.test(lastMsg);
  throw e;
}

// Tách 1 chuỗi key thành nhiều key: mỗi dòng / phẩy / chấm phẩy 1 key. Dedupe, bỏ rỗng.
function parseKeys(key) {
  if (Array.isArray(key)) return [...new Set(key.map(k => String(k).trim()).filter(Boolean))];
  return [...new Set(String(key || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean))];
}

// XOAY VÒNG NHIỀU KEY: thử lần lượt từng key; khi 1 key hết quota (QUOTA_EXCEEDED)
// hoặc quá tải kéo dài thì chuyển sang key kế (key khác có quota/capacity riêng).
// Giữ nguyên chữ ký cũ (retryCount không còn dùng) để không phá chỗ gọi.
async function callGemini(systemPrompt, userContent, key, retryCount = 0, image, expectJson = false) {
  const keys = parseKeys(key);
  if (!keys.length) throw new Error('NO_GEMINI_KEY');

  let lastErr = null;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await callGeminiSingle(systemPrompt, userContent, keys[i], image, expectJson);
    } catch (e) {
      lastErr = e;
      const rotatable = e.message === 'QUOTA_EXCEEDED' || e.geminiOverloaded
        || /high demand|overloaded|UNAVAILABLE|503|quota|RESOURCE_EXHAUSTED|API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(e.message);
      if (rotatable && i < keys.length - 1) {
        console.log(`[Gemini Provider] Key #${i + 1} hết quota/quá tải (${e.message}) → xoay sang key #${i + 2}/${keys.length}...`);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Gemini generation failed');
}

module.exports = { callGemini };
