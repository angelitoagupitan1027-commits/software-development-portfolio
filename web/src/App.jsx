import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Portfolio from './pages/Portfolio.jsx';
import TradeLedger from './pages/TradeLedger.jsx';
import BreakEven from './pages/BreakEven.jsx';
import StrategyLab from './pages/StrategyLab.jsx';
import RiskManagement from './pages/RiskManagement.jsx';
import Intelligence from './pages/Intelligence.jsx';
import MarcoAdvisor from './pages/MarcoAdvisor.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="loading-row">
          <span className="spinner" />
          <span>Starting MARCO AI…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/ledger" element={<TradeLedger />} />
        <Route path="/break-even" element={<BreakEven />} />
        <Route path="/strategy-lab" element={<StrategyLab />} />
        <Route path="/risk" element={<RiskManagement />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/advisor" element={<MarcoAdvisor />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
