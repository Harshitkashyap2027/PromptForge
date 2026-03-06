import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils/helpers';
import './WorkspacesPage.css';

export default function WorkspacesPage({ addToast }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  async function fetchWorkspaces() {
    setLoading(true);
    try {
      const q = query(collection(db, 'workspaces'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setWorkspaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      // In demo mode (no Firebase configured), use empty list
      console.warn('Firestore unavailable:', err.message);
      setWorkspaces([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchWorkspaces(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'workspaces'), {
        name: form.name.trim(),
        description: form.description.trim(),
        createdAt: serverTimestamp(),
        promptCount: 0,
      });
      addToast(`Workspace "${form.name}" created!`, 'success');
      setShowModal(false);
      setForm({ name: '', description: '' });
      navigate(`/workspace/${docRef.id}`);
    } catch (err) {
      addToast('Failed to create workspace: ' + err.message, 'error');
    }
    setCreating(false);
  }

  async function handleDelete(ws, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'workspaces', ws.id));
      setWorkspaces(prev => prev.filter(w => w.id !== ws.id));
      addToast('Workspace deleted.', 'info');
    } catch (err) {
      addToast('Failed to delete: ' + err.message, 'error');
    }
  }

  return (
    <div className="workspaces-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workspaces</h1>
          <p className="page-subtitle">Manage your AI prompt projects</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + New Workspace
        </button>
      </div>

      {loading ? (
        <div className="workspaces-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="workspace-card skeleton-card">
              <div className="skeleton" style={{ height: 22, width: '60%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⚡</div>
          <h2>No workspaces yet</h2>
          <p>Create your first workspace to start building AI prompts.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="workspaces-grid">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className="workspace-card card"
              onClick={() => navigate(`/workspace/${ws.id}`)}
            >
              <div className="ws-header">
                <div className="ws-icon">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <button
                  className="btn-icon ws-delete"
                  onClick={(e) => handleDelete(ws, e)}
                  data-tooltip="Delete workspace"
                  aria-label="Delete workspace"
                >
                  ✕
                </button>
              </div>
              <h3 className="ws-name">{ws.name}</h3>
              {ws.description && <p className="ws-desc">{ws.description}</p>}
              <div className="ws-meta">
                <span className="tag">{ws.promptCount || 0} prompts</span>
                <span className="ws-date">{formatDate(ws.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.25rem' }}>New Workspace</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Support Chatbot"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Brief description of this project..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
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
                  disabled={creating || !form.name.trim()}
                >
                  {creating ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
