/**
 * Extracts variable names from a template string.
 * Variables are enclosed in double curly braces: {{variableName}}
 * @param {string} template
 * @returns {string[]} unique variable names
 */
export function extractVariables(template) {
  const regex = /\{\{(\w+)\}\}/g;
  const vars = new Set();
  let match;
  while ((match = regex.exec(template)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

/**
 * Injects variable values into a template string.
 * @param {string} template
 * @param {Record<string, string>} variables
 * @returns {string}
 */
export function injectVariables(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return variables[name] !== undefined ? variables[name] : `{{${name}}}`;
  });
}

/**
 * Formats a number of milliseconds as a human-readable latency string.
 * @param {number} ms
 * @returns {string}
 */
export function formatLatency(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Estimates the token cost given model name, prompt tokens and completion tokens.
 * Prices are approximate and in USD per 1K tokens.
 * @param {string} model
 * @param {number} promptTokens
 * @param {number} completionTokens
 * @returns {number} estimated cost in USD
 */
export function estimateCost(model, promptTokens, completionTokens) {
  const pricing = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  };
  const p = pricing[model] || { input: 0.001, output: 0.002 };
  return (promptTokens / 1000) * p.input + (completionTokens / 1000) * p.output;
}

/**
 * Generates a new version ID based on existing versions.
 * @param {string[]} existingVersionIds - e.g. ['v1', 'v2']
 * @returns {string} e.g. 'v3'
 */
export function generateVersionId(existingVersionIds) {
  const nums = existingVersionIds.map(id => parseInt(id.replace('v', ''), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `v${next}`;
}

/**
 * Formats a Firestore Timestamp or Date to a readable string.
 * @param {Date|{toDate:()=>Date}|null} ts
 * @returns {string}
 */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
