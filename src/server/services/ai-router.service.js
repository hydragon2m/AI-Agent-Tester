const { callGemini } = require('../ai/providers/gemini.provider');
const { callClaude } = require('../ai/providers/claude.provider');
const { callOpenAI } = require('../ai/providers/openai.provider');

const PROVIDER_META = {
  gemini: { label: 'Gemini' },
  claude: { label: 'Claude' },
  openai: { label: 'GPT-4o' },
  codex: { label: 'Codex' },
};

const { getActiveKey, getProviderSettings, getProviderDetails } = require('./provider.service');

// Fallback mặc định khi provider chưa có priority trong DB — KHÔNG đảo (CLAUDE.md)
const DEFAULT_ORDER = ['claude', 'gemini', 'openai', 'codex'];

async function callCodex(systemPrompt, userContent, key, apiBase, modelName, image, expectJson = false) {
  const baseUrl = apiBase || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const userMessageContent = image
    ? [
        { type: 'text', text: userContent },
        { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
      ]
    : userContent;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelName || 'gpt-4o',
      max_tokens: expectJson ? 16384 : 8192,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageContent },
      ],
      ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAI(systemPrompt, userContent, image, expectJson = false) {
  // Query DB keys first, fall back to environment variables
  const dbGeminiKey = await getActiveKey('gemini');
  const dbClaudeKey = await getActiveKey('claude');
  const dbOpenaiKey = await getActiveKey('openai');
  const codexDetails = await getProviderDetails('codex');

  const providers = {
    gemini: { 
      key: dbGeminiKey || process.env.GEMINI_API_KEY, 
      enabled: !!(dbGeminiKey || process.env.GEMINI_API_KEY) 
    },
    claude: { 
      key: dbClaudeKey || process.env.CLAUDE_API_KEY, 
      enabled: !!(dbClaudeKey || process.env.CLAUDE_API_KEY) 
    },
    openai: { 
      key: dbOpenaiKey || process.env.OPENAI_API_KEY, 
      enabled: !!(dbOpenaiKey || process.env.OPENAI_API_KEY) 
    },
    codex: { 
      key: codexDetails?.key || process.env.CODEX_API_KEY, 
      enabled: !!(codexDetails?.enabled || process.env.CODEX_API_KEY),
      api_base: codexDetails?.api_base || process.env.CODEX_API_BASE_URL || 'https://api.openai.com/v1',
      model_name: codexDetails?.model_name || process.env.CODEX_MODEL || 'gpt-4o'
    }
  };

  // Sắp theo priority đã lưu trong DB (số nhỏ hơn = ưu tiên trước); provider chưa có setting dùng DEFAULT_ORDER
  const settings = await getProviderSettings();
  const priorityByProvider = {};
  for (const s of settings) priorityByProvider[s.provider] = s.priority;

  const ORDER = [...DEFAULT_ORDER].sort((a, b) => {
    const pa = priorityByProvider[a] ?? (DEFAULT_ORDER.indexOf(a) + 1);
    const pb = priorityByProvider[b] ?? (DEFAULT_ORDER.indexOf(b) + 1);
    return pa - pb;
  });

  const available = ORDER.filter(p => providers[p]?.enabled && providers[p]?.key);

  if (available.length === 0) {
    throw new Error('NO_API_KEYS_ON_SERVER');
  }

  let lastError = null;
  for (const provider of available) {
    try {
      console.log(`[AI Router Service] Attempting generation with ${PROVIDER_META[provider].label}...`);
      let result;
      const key = providers[provider].key;

      if (provider === 'gemini') result = await callGemini(systemPrompt, userContent, key, 0, image, expectJson);
      else if (provider === 'claude') result = await callClaude(systemPrompt, userContent, key, image);
      else if (provider === 'openai') result = await callOpenAI(systemPrompt, userContent, key, 0, image, expectJson);
      else if (provider === 'codex') {
        result = await callCodex(
          systemPrompt,
          userContent,
          key,
          providers.codex.api_base,
          providers.codex.model_name,
          image,
          expectJson
        );
      }

      return {
        provider,
        output: result
      };
    } catch (e) {
      console.error(`[AI Router Service] Error with ${provider}:`, e.message);
      lastError = e;
      const nextIdx = available.indexOf(provider) + 1;
      if (nextIdx < available.length) {
        console.log(`[AI Router Service] ${PROVIDER_META[provider].label} failed (${e.message}). Falling back to next...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      } else {
        throw e;
      }
    }
  }

  throw lastError || new Error('ALL_PROVIDERS_EXHAUSTED');
}

module.exports = { callAI };
