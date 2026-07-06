const { callGemini } = require('../ai/providers/gemini.provider');
const { callClaude } = require('../ai/providers/claude.provider');
const { callOpenAI } = require('../ai/providers/openai.provider');

const PROVIDER_META = {
  gemini: { label: 'Gemini' },
  claude: { label: 'Claude' },
  openai: { label: 'GPT-4o' },
};

const { getActiveKey } = require('./provider.service');

async function callAI(systemPrompt, userContent, image) {
  // Query DB keys first, fall back to environment variables
  const dbGeminiKey = await getActiveKey('gemini');
  const dbClaudeKey = await getActiveKey('claude');
  const dbOpenaiKey = await getActiveKey('openai');

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
    }
  };

  const ORDER = ['gemini', 'claude', 'openai'];
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

      if (provider === 'gemini') result = await callGemini(systemPrompt, userContent, key, 0, image);
      else if (provider === 'claude') result = await callClaude(systemPrompt, userContent, key, image);
      else if (provider === 'openai') result = await callOpenAI(systemPrompt, userContent, key, 0, image);

      return {
        provider,
        output: result
      };
    } catch (e) {
      console.error(`[AI Router Service] Error with ${provider}:`, e.message);
      lastError = e;
      const isExhausted = e.message === 'QUOTA_EXCEEDED' || e.message.includes('NO_KEY');
      if (isExhausted) {
        const nextIdx = available.indexOf(provider) + 1;
        if (nextIdx < available.length) {
          console.log(`[AI Router Service] ${PROVIDER_META[provider].label} exhausted/unavailable. Falling back to next...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      } else {
        throw e;
      }
    }
  }

  throw lastError || new Error('ALL_PROVIDERS_EXHAUSTED');
}

module.exports = { callAI };
