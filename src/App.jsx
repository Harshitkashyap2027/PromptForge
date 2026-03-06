import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/ToastContainer';
import WorkspacesPage from './pages/WorkspacesPage';
import PromptsPage from './pages/PromptsPage';
import EditorPage from './pages/EditorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { useToast } from './hooks/useToast';
import './App.css';

export default function App() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<WorkspacesPage addToast={addToast} />} />
            <Route path="/workspace/:workspaceId" element={<PromptsPage addToast={addToast} />} />
            <Route path="/workspace/:workspaceId/prompt/:promptId" element={<EditorPage addToast={addToast} />} />
            <Route path="/workspace/:workspaceId/analytics" element={<AnalyticsPage addToast={addToast} />} />
          </Routes>
        </main>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </BrowserRouter>
  );
}

