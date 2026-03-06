import { useState } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { injectVariables, formatLatency, estimateCost } from '../utils/helpers';
import './ArenaPanel.css';

const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
];

const FUNCTIONS_URL =
  import.meta.env.VITE_CLOUD_FUNCTIONS_URL ||
  'https://us-central1-demo-project.cloudfunctions.net';

export default function ArenaPanel({
  template,
  variableValues,
  variables,
  workspaceId,
  promptId,
  addToast,
}) {
  const [modelA, setModelA] = useState('gemini-2.0-flash');
  const [modelB, setModelB] = useState('gpt-4o-mini');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const resolvedPrompt = injectVariables(template, variableValues);

  const allVarsFilled = variables.every(v => variableValues[v]?.trim());

  async function runTest() {
    if (!template.trim()) {
      addToast('Template is empty.', 'error');
      return;
    }
    if (variables.length > 0 && !allVarsFilled) {
      addToast('Please fill in all variable values before running.', 'error');
      return;
    }
    if (modelA === modelB) {
      addToast('Select two different models for comparison.', 'error');
      return;
    }

    setRunning(true);
    setError(null);
    setResults(null);

    try {
      const startTime = Date.now();

      const response = await fetch(`${FUNCTIONS_URL}/runArenaTest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptTemplate: template,
          variables: variableValues,
          modelA,
          modelB,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const totalTime = Date.now() - startTime;

      const arenaResult = {
        modelA: {
          model: modelA,
          response: data.resultA?.text || data.resultA || '',
          latency: data.resultA?.latencyMs || Math.round(totalTime * 0.48),
          promptTokens: data.resultA?.promptTokens || 0,
          completionTokens: data.resultA?.completionTokens || 0,
        },
        modelB: {
          model: modelB,
          response: data.resultB?.text || data.resultB || '',
          latency: data.resultB?.latencyMs || Math.round(totalTime * 0.52),
          promptTokens: data.resultB?.promptTokens || 0,
          completionTokens: data.resultB?.completionTokens || 0,
        },
        resolvedPrompt,
        runAt: new Date(),
      };

      setResults(arenaResult);

      // Save metrics to Firestore
      try {
        await addDoc(
          collection(db, 'workspaces', workspaceId, 'prompts', promptId, 'metrics'),
          {
            modelA,
            modelB,
            latencyA: arenaResult.modelA.latency,
            latencyB: arenaResult.modelB.latency,
            promptTokensA: arenaResult.modelA.promptTokens,
            completionTokensA: arenaResult.modelA.completionTokens,
            promptTokensB: arenaResult.modelB.promptTokens,
            completionTokensB: arenaResult.modelB.completionTokens,
            costA: estimateCost(modelA, arenaResult.modelA.promptTokens, arenaResult.modelA.completionTokens),
            costB: estimateCost(modelB, arenaResult.modelB.promptTokens, arenaResult.modelB.completionTokens),
            resolvedPrompt,
            createdAt: serverTimestamp(),
          }
        );
      } catch (metricsErr) {
        console.warn('Could not save metrics:', metricsErr.message);
      }

      addToast('Arena test completed!', 'success');
    } catch (err) {
      setError(err.message);
      addToast('Test failed: ' + err.message, 'error');
    }

    setRunning(false);
  }

  return (
    <div className="arena-panel">
      <div className="arena-header">
        <div>
          <h2 className="arena-title">⚡ Arena — A/B Testing</h2>
          <p className="arena-subtitle">Compare two AI models side-by-side</p>
        </div>
      </div>

      <div className="arena-config">
        <div className="arena-prompt-preview">
          <div className="arena-label">Resolved Prompt Preview</div>
          <pre className="resolved-prompt mono">
            {resolvedPrompt || 'Write a template above to preview…'}
          </pre>
        </div>

        <div className="model-selectors">
          <div className="model-slot model-a">
            <div className="model-slot-header">
              <span className="model-badge model-badge-a">Model A</span>
            </div>
            <select value={modelA} onChange={e => setModelA(e.target.value)}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="vs-divider">VS</div>
          <div className="model-slot model-b">
            <div className="model-slot-header">
              <span className="model-badge model-badge-b">Model B</span>
            </div>
            <select value={modelB} onChange={e => setModelB(e.target.value)}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <button
          className="btn-primary run-btn"
          onClick={runTest}
          disabled={running || !template.trim()}
        >
          {running ? (
            <span className="run-spinner">
              <span className="spinner-dot" /> Running…
            </span>
          ) : (
            '▶ Run Test'
          )}
        </button>
      </div>

      {error && (
        <div className="arena-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Skeleton while loading */}
      {running && !results && (
        <div className="arena-results">
          <div className="result-card">
            <div className="result-header">
              <div className="skeleton" style={{ height: 18, width: 120 }} />
              <div className="skeleton" style={{ height: 14, width: 80 }} />
            </div>
            <div className="skeleton" style={{ height: 16, width: '100%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '90%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '85%' }} />
          </div>
          <div className="result-card">
            <div className="result-header">
              <div className="skeleton" style={{ height: 18, width: 120 }} />
              <div className="skeleton" style={{ height: 14, width: 80 }} />
            </div>
            <div className="skeleton" style={{ height: 16, width: '100%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '95%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        </div>
      )}

      {results && (
        <div className="arena-results">
          <ResultCard
            label="Model A"
            data={results.modelA}
            colorClass="model-a"
          />
          <ResultCard
            label="Model B"
            data={results.modelB}
            colorClass="model-b"
          />
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, data, colorClass }) {
  const cost = estimateCost(data.model, data.promptTokens, data.completionTokens);
  const totalTokens = data.promptTokens + data.completionTokens;

  return (
    <div className={`result-card ${colorClass}`}>
      <div className="result-header">
        <div>
          <span className={`model-badge model-badge-${colorClass === 'model-a' ? 'a' : 'b'}`}>
            {label}
          </span>
          <span className="result-model-name">{data.model}</span>
        </div>
        <div className="result-stats">
          <span className="stat-pill latency">
            ⏱ {formatLatency(data.latency)}
          </span>
          {totalTokens > 0 && (
            <span className="stat-pill tokens">
              ◎ {totalTokens.toLocaleString()} tokens
            </span>
          )}
          {cost > 0 && (
            <span className="stat-pill cost">
              $ {cost.toFixed(5)}
            </span>
          )}
        </div>
      </div>
      <div className="result-body">
        <pre className="result-text mono">{data.response || '(no response)'}</pre>
      </div>
    </div>
  );
}
