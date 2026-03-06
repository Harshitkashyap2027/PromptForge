import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatLatency, formatDate } from '../utils/helpers';
import './AnalyticsPage.css';

export default function AnalyticsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [allMetrics, setAllMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const [wsSnap, promptsSnap] = await Promise.all([
        getDoc(doc(db, 'workspaces', workspaceId)),
        getDocs(collection(db, 'workspaces', workspaceId, 'prompts')),
      ]);

      if (wsSnap.exists()) setWorkspace({ id: wsSnap.id, ...wsSnap.data() });

      const promptDocs = promptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPrompts(promptDocs);

      // Fetch metrics for each prompt
      const metricsArrays = await Promise.all(
        promptDocs.map(async p => {
          try {
            const mSnap = await getDocs(
              query(
                collection(db, 'workspaces', workspaceId, 'prompts', p.id, 'metrics'),
                orderBy('createdAt', 'desc'),
                limit(50)
              )
            );
            return mSnap.docs.map(d => ({ id: d.id, promptId: p.id, promptTitle: p.title, ...d.data() }));
          } catch {
            return [];
          }
        })
      );
      setAllMetrics(metricsArrays.flat());
    } catch (err) {
      console.warn('Firestore unavailable:', err.message);
      setWorkspace({ id: workspaceId, name: 'Demo Workspace' });
      setPrompts([]);
      setAllMetrics([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [workspaceId]);

  // Compute aggregate stats
  const totalRuns = allMetrics.length;
  const avgLatencyA = totalRuns > 0
    ? Math.round(allMetrics.reduce((s, m) => s + (m.latencyA || 0), 0) / totalRuns)
    : 0;
  const avgLatencyB = totalRuns > 0
    ? Math.round(allMetrics.reduce((s, m) => s + (m.latencyB || 0), 0) / totalRuns)
    : 0;
  const totalCost = allMetrics.reduce((s, m) => s + (m.costA || 0) + (m.costB || 0), 0);
  const totalTokens = allMetrics.reduce(
    (s, m) =>
      s +
      (m.promptTokensA || 0) +
      (m.completionTokensA || 0) +
      (m.promptTokensB || 0) +
      (m.completionTokensB || 0),
    0
  );

  // Model usage frequency
  const modelCounts = {};
  allMetrics.forEach(m => {
    if (m.modelA) modelCounts[m.modelA] = (modelCounts[m.modelA] || 0) + 1;
    if (m.modelB) modelCounts[m.modelB] = (modelCounts[m.modelB] || 0) + 1;
  });
  const topModels = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const recentMetrics = [...allMetrics]
    .sort((a, b) => {
      const ta = a.createdAt?.toDate?.() || new Date(0);
      const tb = b.createdAt?.toDate?.() || new Date(0);
      return tb - ta;
    })
    .slice(0, 8);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="page-header">
          <div className="skeleton" style={{ height: 28, width: 240, marginBottom: 8 }} />
        </div>
        <div className="bento-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bento-card">
              <div className="skeleton" style={{ height: 40, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <button className="btn-icon" onClick={() => navigate('/')}>Workspaces</button>
            <span className="breadcrumb-sep">›</span>
            <button className="btn-icon" onClick={() => navigate(`/workspace/${workspaceId}`)}>
              {workspace?.name || workspaceId}
            </button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Analytics</span>
          </div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="page-subtitle">Performance insights for {workspace?.name}</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => navigate(`/workspace/${workspaceId}`)}
        >
          ← Back to Prompts
        </button>
      </div>

      {/* Bento grid of stat cards */}
      <div className="bento-grid">
        <div className="bento-card stat-card">
          <div className="stat-value">{totalRuns}</div>
          <div className="stat-label">Total Test Runs</div>
          <div className="stat-icon">◉</div>
        </div>

        <div className="bento-card stat-card">
          <div className="stat-value">{prompts.length}</div>
          <div className="stat-label">Active Prompts</div>
          <div className="stat-icon">✏</div>
        </div>

        <div className="bento-card stat-card">
          <div className="stat-value">{totalTokens.toLocaleString()}</div>
          <div className="stat-label">Total Tokens Used</div>
          <div className="stat-icon">⬡</div>
        </div>

        <div className="bento-card stat-card accent-cost">
          <div className="stat-value">${totalCost.toFixed(4)}</div>
          <div className="stat-label">Estimated Total Cost</div>
          <div className="stat-icon">$</div>
        </div>

        {/* Latency comparison card */}
        <div className="bento-card bento-wide latency-card">
          <h3 className="bento-card-title">Avg Latency Comparison</h3>
          {totalRuns === 0 ? (
            <p className="empty-metric">No data yet — run some Arena tests!</p>
          ) : (
            <div className="latency-bars">
              <div className="latency-row">
                <span className="latency-label model-a-text">Model A avg</span>
                <div className="latency-bar-track">
                  <div
                    className="latency-bar model-a-bar"
                    style={{
                      width: `${Math.min(100, (avgLatencyA / Math.max(avgLatencyA, avgLatencyB)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="latency-value">{formatLatency(avgLatencyA)}</span>
              </div>
              <div className="latency-row">
                <span className="latency-label model-b-text">Model B avg</span>
                <div className="latency-bar-track">
                  <div
                    className="latency-bar model-b-bar"
                    style={{
                      width: `${Math.min(100, (avgLatencyB / Math.max(avgLatencyA, avgLatencyB)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="latency-value">{formatLatency(avgLatencyB)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Top models card */}
        <div className="bento-card top-models-card">
          <h3 className="bento-card-title">Most Used Models</h3>
          {topModels.length === 0 ? (
            <p className="empty-metric">No data yet.</p>
          ) : (
            <ul className="model-list">
              {topModels.map(([model, count]) => (
                <li key={model} className="model-list-item">
                  <span className="model-name mono">{model}</span>
                  <span className="model-count tag">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent runs */}
        <div className="bento-card bento-full recent-runs-card">
          <h3 className="bento-card-title">Recent Test Runs</h3>
          {recentMetrics.length === 0 ? (
            <p className="empty-metric">No test runs yet. Open the Arena to start testing!</p>
          ) : (
            <div className="runs-table-wrapper">
              <table className="runs-table">
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Model A</th>
                    <th>Model B</th>
                    <th>Latency A</th>
                    <th>Latency B</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMetrics.map(m => {
                    const tokens =
                      (m.promptTokensA || 0) +
                      (m.completionTokensA || 0) +
                      (m.promptTokensB || 0) +
                      (m.completionTokensB || 0);
                    const cost = (m.costA || 0) + (m.costB || 0);
                    return (
                      <tr key={m.id}>
                        <td
                          className="prompt-link"
                          onClick={() =>
                            navigate(
                              `/workspace/${workspaceId}/prompt/${m.promptId}`
                            )
                          }
                        >
                          {m.promptTitle || m.promptId}
                        </td>
                        <td className="model-a-text mono">{m.modelA}</td>
                        <td className="model-b-text mono">{m.modelB}</td>
                        <td>{formatLatency(m.latencyA || 0)}</td>
                        <td>{formatLatency(m.latencyB || 0)}</td>
                        <td>{tokens.toLocaleString()}</td>
                        <td>${cost.toFixed(5)}</td>
                        <td>{formatDate(m.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
