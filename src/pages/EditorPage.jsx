import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { extractVariables, generateVersionId, formatDate } from '../utils/helpers';
import ArenaPanel from '../components/ArenaPanel';
import './EditorPage.css';

const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
];

export default function EditorPage({ addToast }) {
  const { workspaceId, promptId } = useParams();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState(null);
  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [template, setTemplate] = useState('');
  const [variables, setVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [model, setModel] = useState('gemini-2.0-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [saving, setSaving] = useState(false);

  // Arena panel visibility
  const [showArena, setShowArena] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [promptSnap, versionsSnap] = await Promise.all([
        getDoc(doc(db, 'workspaces', workspaceId, 'prompts', promptId)),
        getDocs(
          query(
            collection(db, 'workspaces', workspaceId, 'prompts', promptId, 'versions'),
            orderBy('createdAt', 'desc')
          )
        ),
      ]);

      if (promptSnap.exists()) {
        setPrompt({ id: promptSnap.id, ...promptSnap.data() });
      }

      const versionDocs = versionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVersions(versionDocs);

      if (versionDocs.length > 0) {
        const latest = versionDocs[0];
        setActiveVersion(latest);
        setTemplate(latest.template_string || '');
        setModel(latest.model_used || 'gemini-2.0-flash');
        setTemperature(latest.temperature ?? 0.7);
      }
    } catch (err) {
      console.warn('Firestore unavailable:', err.message);
      setPrompt({ id: promptId, title: 'Demo Prompt' });
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [workspaceId, promptId]);

  // Extract variables whenever template changes
  useEffect(() => {
    const vars = extractVariables(template);
    setVariables(vars);
    // Keep existing values, add new empty ones
    setVariableValues(prev => {
      const next = {};
      vars.forEach(v => { next[v] = prev[v] || ''; });
      return next;
    });
  }, [template]);

  async function handleSaveVersion() {
    if (!template.trim()) {
      addToast('Template cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      const existingIds = versions.map(v => v.id);
      const newVersionId = generateVersionId(existingIds);

      await addDoc(
        collection(db, 'workspaces', workspaceId, 'prompts', promptId, 'versions'),
        {
          template_string: template,
          model_used: model,
          temperature,
          createdAt: serverTimestamp(),
          versionId: newVersionId,
        }
      );

      await updateDoc(doc(db, 'workspaces', workspaceId, 'prompts', promptId), {
        versionCount: versions.length + 1,
        activeVersion: newVersionId,
      });

      addToast(`Version ${newVersionId} saved!`, 'success');
      fetchData();
    } catch (err) {
      addToast('Save failed: ' + err.message, 'error');
    }
    setSaving(false);
  }

  function loadVersion(v) {
    setActiveVersion(v);
    setTemplate(v.template_string || '');
    setModel(v.model_used || 'gemini-2.0-flash');
    setTemperature(v.temperature ?? 0.7);
    addToast(`Loaded ${v.versionId}`, 'info');
  }

  if (loading) {
    return (
      <div className="editor-page">
        <div className="skeleton" style={{ height: 32, width: 300, marginBottom: 16 }} />
        <div className="editor-layout">
          <div className="editor-main">
            <div className="skeleton" style={{ height: 300 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div>
          <div className="breadcrumb">
            <button className="btn-icon" onClick={() => navigate('/')}>Workspaces</button>
            <span className="breadcrumb-sep">›</span>
            <button
              className="btn-icon"
              onClick={() => navigate(`/workspace/${workspaceId}`)}
            >
              Prompts
            </button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">{prompt?.title || promptId}</span>
          </div>
          <h1 className="page-title">{prompt?.title}</h1>
        </div>
        <div className="editor-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowArena(a => !a)}
          >
            {showArena ? '✕ Close Arena' : '⚡ Open Arena'}
          </button>
          <button
            className="btn-primary"
            onClick={handleSaveVersion}
            disabled={saving}
          >
            {saving ? 'Saving...' : '↑ Save Version'}
          </button>
        </div>
      </div>

      <div className={`editor-layout ${showArena ? 'with-arena' : ''}`}>
        {/* Left: editor + settings */}
        <div className="editor-main">
          <div className="editor-section">
            <div className="section-header">
              <h3>Prompt Template</h3>
              <span className="hint-text mono">Use {'{{variable}}'} for dynamic values</span>
            </div>
            <div className="template-wrapper">
              <textarea
                className="template-editor mono"
                value={template}
                onChange={e => setTemplate(e.target.value)}
                placeholder={`Write your prompt here...\n\nUse {{variable_name}} to insert dynamic values.\nExample:\nYou are a helpful assistant. The user says: {{user_message}}`}
                spellCheck={false}
              />
              {/* Highlight overlay for variables — visual cue */}
              <div className="variable-count-badge">
                {variables.length > 0 && (
                  <span className="tag">
                    {variables.length} variable{variables.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic variable fields */}
          {variables.length > 0 && (
            <div className="variables-section">
              <div className="section-header">
                <h3>Variables</h3>
                <span className="hint-text">Fill in test values for the Arena</span>
              </div>
              <div className="variables-grid">
                {variables.map(v => (
                  <div key={v} className="variable-field slide-in">
                    <label className="var-label">
                      <span className="var-brace">{'{{'}
                      </span>
                      <span className="var-name">{v}</span>
                      <span className="var-brace">{'}}'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter value for ${v}…`}
                      value={variableValues[v] || ''}
                      onChange={e =>
                        setVariableValues(prev => ({ ...prev, [v]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model & temperature settings */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Model Settings</h3>
            </div>
            <div className="settings-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Model</label>
                <select value={model} onChange={e => setModel(e.target.value)}>
                  {MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Temperature: {temperature.toFixed(1)}</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: version history */}
        <div className="version-panel">
          <div className="section-header" style={{ marginBottom: '0.75rem' }}>
            <h3>Version History</h3>
            <span className="tag">{versions.length}</span>
          </div>

          {versions.length === 0 ? (
            <div className="version-empty">
              <p>No versions saved yet.</p>
              <p className="hint-text">Save your first version above.</p>
            </div>
          ) : (
            <div className="version-list">
              {versions.map(v => (
                <div
                  key={v.id}
                  className={`version-item ${activeVersion?.id === v.id ? 'active' : ''}`}
                  onClick={() => loadVersion(v)}
                >
                  <div className="version-id-row">
                    <span className="version-id mono">{v.versionId}</span>
                    {activeVersion?.id === v.id && (
                      <span className="version-badge">active</span>
                    )}
                  </div>
                  <div className="version-meta">
                    <span>{v.model_used}</span>
                    <span>T: {v.temperature}</span>
                  </div>
                  <div className="version-date">{formatDate(v.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Arena panel (A/B testing) */}
        {showArena && (
          <ArenaPanel
            template={template}
            variableValues={variableValues}
            variables={variables}
            workspaceId={workspaceId}
            promptId={promptId}
            addToast={addToast}
          />
        )}
      </div>
    </div>
  );
}
