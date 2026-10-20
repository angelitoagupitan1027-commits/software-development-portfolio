import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { api } from '../lib/api.js';
import { RANGES } from '../lib/range.js';

const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  wallet: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2',
  list: 'M4 6h16M4 12h16M4 18h10',
  calc: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2',
  flask: 'M9 3h6M10 3v6L5 20h14L14 9V3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4L19 13a7 7 0 000-1z',
};

const NAV = [
  { to: '/', label: 'Overview', icon: 'grid' },
  { to: '/portfolio', label: 'Portfolio', icon: 'wallet' },
  { to: '/ledger', label: 'Trade Ledger', icon: 'list' },
  { to: '/break-even', label: 'Break-Even Calculator', icon: 'calc' },
  { to: '/strategy-lab', label: 'Strategy Lab', icon: 'flask' },
  { to: '/risk', label: 'Risk Management', icon: 'shield' },
  { to: '/intelligence', label: 'Trading Business Intelligence', icon: 'chart' },
  { to: '/advisor', label: 'Marco AI Advisor', icon: 'spark' },
  { to: '/reports', label: 'Reports', icon: 'doc' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];

function Icon({ name }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const TITLES = {
  '/': ['Overview', 'Business snapshot and key performance indicators'],
  '/portfolio': ['Portfolio', 'Holdings, allocation and unrealized performance'],
  '/ledger': ['Trade Ledger', 'Record, review and audit every transaction'],
  '/break-even': ['Break-Even Calculator', 'Plan the exit price before you enter'],
  '/strategy-lab': ['Strategy Lab', 'Compare and review strategy performance'],
  '/risk': ['Risk Management', 'Exposure, limits and advisory alerts'],
  '/intelligence': ['Trading Business Intelligence', 'Charts and KPIs from verified records'],
  '/advisor': ['Marco AI Advisor', 'Analysis grounded in your verified metrics'],
  '/reports': ['Reports', 'Daily, weekly and monthly business reports'],
  '/settings': ['Settings', 'Capital, currency, risk limits and integrations'],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { model, displayCurrency, setDisplayCurrency, refresh } = useData();
  const [range, setRange] = useState('all');
  const [okx, setOkx] = useState(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.get('/api/okx/status').then(setOkx).catch(() => setOkx(null));
  }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const [title, subtitle] = TITLES[location.pathname] || ['MARCO AI', ''];
  const demo = model?.meta?.demoMode;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">MA</div>
          <div>
            <div className="brand-name">MARCO AI</div>
            <div className="brand-sub">Trading Business OS</div>
          </div>
        </div>
        <div className="nav-group-label">Workspace</div>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="row between">
            <span>Signed in as</span>
          </div>
          <div style={{ color: 'var(--text-2)', marginTop: 3 }}>{user?.name || 'Owner'}</div>
          <div style={{ marginTop: 2 }}>{user?.email}</div>
          <button className="btn ghost sm" style={{ marginTop: 10, width: '100%' }} onClick={logout} type="button">
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost sm menu-btn" onClick={() => setOpen((v) => !v)} type="button" aria-label="Toggle navigation">
            ☰
          </button>
          <div>
            <div className="topbar-title">MARCO AI</div>
            <div className="topbar-sub">{title}</div>
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-controls">
            <label className="muted" style={{ fontSize: 11.5 }}>
              Range
            </label>
            <select className="select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select className="select" value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)} aria-label="Reporting currency">
              <option value="PHP">PHP ₱</option>
              <option value="USDT">USDT</option>
            </select>
            <span className={`badge ${okx?.status === 'connected' ? 'pos' : okx?.status === 'error' ? 'neg' : ''}`} title="OKX connection status">
              <span className={`dot ${okx?.status === 'connected' ? 'pos' : okx?.status === 'error' ? 'neg' : 'muted'}`} />
              OKX {okx?.status === 'connected' ? 'Connected' : okx?.status === 'error' ? 'Error' : 'Not connected'}
            </span>
            <button className="btn ghost sm" onClick={refresh} type="button" title="Reload data">
              Refresh
            </button>
          </div>
        </header>

        <main className="content">
          {demo && (
            <div className="banner demo" style={{ marginBottom: 16 }}>
              <strong>DEMO DATA</strong>
              <span>
                All figures below are generated from clearly labelled sample records. No real trades, balances or market prices are
                presented as actual results. Turn off demo mode in Settings to work with real records only.
              </span>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 19 }}>{title}</h1>
            <p className="muted" style={{ fontSize: 12.5 }}>
              {subtitle}
            </p>
          </div>
          <Outlet context={{ range, setRange }} />
        </main>
      </div>
    </div>
  );
}
