import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  getDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils/helpers';
import './PromptsPage.css';

export default function PromptsPage({ addToast }) {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', tags: '' });
  const [creating, setCreating] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [wsSnap, promptsSnap] = await Promise.all([
        getDoc(doc(db, 'workspaces', workspaceId)),
        getDocs(
          query(
            collection(db, 'workspaces', workspaceId, 'prompts'),
            orderBy('createdAt', 'desc')
          )
        ),
      ]);
      if (wsSnap.exists()) setWorkspace({ id: wsSnap.id, ...wsSnap.data() });
      setPrompts(promptsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Firestore unavailable:', err.message);
      setWorkspace({ id: workspaceId, name: 'Demo Workspace' });
      setPrompts([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [workspaceId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const tags = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const promptRef = await addDoc(
        collection(db, 'workspaces', workspaceId, 'prompts'),
        {
          title: form.title.trim(),
          description: form.description.trim(),
          tags,
          createdAt: serverTimestamp(),
          versionCount: 0,
          activeVersion: null,
        }
      );
      await updateDoc(doc(db, 'workspaces', workspaceId), {
        promptCount: increment(1),
      });
      addToast(`Prompt "${form.title}" created!`, 'success');
      setShowModal(false);
      setForm({ title: '', description: '', tags: '' });
      navigate(`/workspace/${workspaceId}/prompt/${promptRef.id}`);
    } catch (err) {
      addToast('Failed to create prompt: ' + err.message, 'error');
    }
    setCreating(false);
  }

  async function handleDelete(prompt, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete prompt "${prompt.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'prompts', prompt.id));
      await updateDoc(doc(db, 'workspaces', workspaceId), {
        promptCount: increment(-1),
      });
      setPrompts(prev => prev.filter(p => p.id !== prompt.id));
      addToast('Prompt deleted.', 'info');
    } catch (err) {
      addToast('Failed to delete: ' + err.message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="prompts-page">
        <div className="page-header">
          <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 36, width: 140 }} />
        </div>
        <div className="prompts-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="prompt-card card">
              <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 14, width: '50%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="prompts-page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <button className="btn-icon" onClick={() => navigate('/')}>Workspaces</button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">{workspace?.name || workspaceId}</span>
          </div>
          <h1 className="page-title">Prompts</h1>
          <p className="page-subtitle">
            {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate(`/workspace/${workspaceId}/analytics`)}
          >
            ◉ Analytics
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + New Prompt
          </button>
        </div>
      </div>

      {prompts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✏</div>
          <h2>No prompts yet</h2>
          <p>Create your first prompt to start experimenting with AI.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create Prompt
          </button>
        </div>
      ) : (
        <div className="prompts-grid">
          {prompts.map(p => (
            <div
              key={p.id}
              className="prompt-card card"
              onClick={() => navigate(`/workspace/${workspaceId}/prompt/${p.id}`)}
            >
              <div className="prompt-card-header">
                <h3 className="prompt-title">{p.title}</h3>
                <button
                  className="btn-icon ws-delete"
                  onClick={(e) => handleDelete(p, e)}
                  data-tooltip="Delete prompt"
                  aria-label="Delete prompt"
                >
                  ✕
                </button>
              </div>
              {p.description && <p className="prompt-desc">{p.description}</p>}
              {p.tags && p.tags.length > 0 && (
                <div className="prompt-tags">
                  {p.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
              <div className="prompt-meta">
                <span className="meta-item">
                  <span className="status-dot active" />
                  {p.versionCount || 0} version{p.versionCount !== 1 ? 's' : ''}
                </span>
                <span className="ws-date">{formatDate(p.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.25rem' }}>New Prompt</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Refund Generator"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="What does this prompt do?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. support, billing, refunds"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating || !form.title.trim()}
                >
                  {creating ? 'Creating...' : 'Create Prompt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
