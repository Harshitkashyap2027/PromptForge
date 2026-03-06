import { NavLink, useParams } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Workspaces', icon: '⬡', exact: true },
];

const WORKSPACE_NAV = [
  { suffix: '', label: 'Prompts', icon: '✏' },
  { suffix: '/analytics', label: 'Analytics', icon: '◉' },
];

export default function Sidebar() {
  const { workspaceId } = useParams();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">⚡</span>
        <span className="brand-name">PromptForge</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">⬡</span>
          <span>Workspaces</span>
        </NavLink>

        {workspaceId && (
          <>
            <div className="nav-section-label">Current Project</div>
            {WORKSPACE_NAV.map(item => (
              <NavLink
                key={item.suffix}
                to={`/workspace/${workspaceId}${item.suffix}`}
                end={item.suffix === ''}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">v1.0.0</span>
      </div>
    </aside>
  );
}
