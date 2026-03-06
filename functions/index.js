/* eslint-disable */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp();

/**
 * Replaces {{variable}} placeholders in a template string with provided values.
 * @param {string} template
 * @param {Record<string, string>} variables
 * @returns {string}
 */
function injectVariables(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return variables[name] !== undefined ? variables[name] : `{{${name}}}`;
  });
}

/**
 * Calls the Google Gemini API (Generative Language REST).
 * Requires GEMINI_API_KEY in Firebase config / environment.
 * @param {string} model - e.g. "gemini-2.0-flash"
 * @param {string} prompt
 * @returns {Promise<{text: string, promptTokens: number, completionTokens: number, latencyMs: number}>}
 */
async function callGemini(model, prompt) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    (functions.config().gemini && functions.config().gemini.api_key) ||
    '';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });

  const start = Date.now();
  const data = await makeHttpsRequest({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  const latencyMs = Date.now() - start;
  const parsed = JSON.parse(data);
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usageMeta = parsed.usageMetadata || {};

  return {
    text,
    promptTokens: usageMeta.promptTokenCount || 0,
    completionTokens: usageMeta.candidatesTokenCount || 0,
    latencyMs,
  };
}

/**
 * Calls the OpenAI Chat Completions API.
 * Requires OPENAI_API_KEY in Firebase config / environment.
 * @param {string} model - e.g. "gpt-4o-mini"
 * @param {string} prompt
 * @returns {Promise<{text: string, promptTokens: number, completionTokens: number, latencyMs: number}>}
 */
async function callOpenAI(model, prompt) {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (functions.config().openai && functions.config().openai.api_key) ||
    '';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  });

  const start = Date.now();
  const data = await makeHttpsRequest({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization: `Bearer ${apiKey}`,
    },
  }, body);

  const latencyMs = Date.now() - start;
  const parsed = JSON.parse(data);
  const text = parsed.choices?.[0]?.message?.content || '';
  const usage = parsed.usage || {};

  return {
    text,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    latencyMs,
  };
}

/**
 * Dispatches a prompt to the correct provider based on model name.
 * @param {string} model
 * @param {string} prompt
 */
async function callModel(model, prompt) {
  const lc = model.toLowerCase();
  if (lc.startsWith('gemini')) {
    return callGemini(model, prompt);
  }
  if (lc.startsWith('gpt')) {
    return callOpenAI(model, prompt);
  }
  throw new Error(`Unsupported model: ${model}`);
}

/**
 * Utility: wraps https.request as a Promise.
 */
function makeHttpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * runArenaTest — HTTP callable Cloud Function.
 *
 * Accepts:
 *   { promptTemplate, variables, modelA, modelB }
 *
 * Returns:
 *   { resultA: { text, promptTokens, completionTokens, latencyMs },
 *     resultB: { text, promptTokens, completionTokens, latencyMs } }
 */
exports.runArenaTest = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { promptTemplate, variables = {}, modelA, modelB } = req.body;

    if (!promptTemplate) {
      res.status(400).json({ error: 'promptTemplate is required' });
      return;
    }
    if (!modelA || !modelB) {
      res.status(400).json({ error: 'modelA and modelB are required' });
      return;
    }
    if (modelA === modelB) {
      res.status(400).json({ error: 'modelA and modelB must be different' });
      return;
    }

    // Inject variables into the prompt
    const resolvedPrompt = injectVariables(promptTemplate, variables);

    try {
      // Call both models concurrently
      const [resultA, resultB] = await Promise.all([
        callModel(modelA, resolvedPrompt),
        callModel(modelB, resolvedPrompt),
      ]);

      res.status(200).json({ resultA, resultB });
    } catch (err) {
      console.error('Arena test error:', err);
      res.status(500).json({ error: err.message });
    }
  });
