import { useCallback, useEffect, useState } from 'react';
import { Card, Loading, Banner, EmptyState, Field, Badge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { money, signedMoney, pct, signedPct, signClass, shortDate } from '../lib/format.js';

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Reports() {
  const { fx, displayCurrency } = useData();
  const [period, setPeriod] = useState('monthly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      setData(await api.get(`/api/reports?${params.toString()}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    const params = new URLSearchParams({ period });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const blob = await api.download(`/api/reports/export.csv?${params.toString()}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marco-ai-${period}-reports.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const m = (v) => money(v, displayCurrency, fx);
  const reports = data?.reports || [];

  return (
    <div className="stack">
      <Card
        title="Business reports"
        desc="Opening and closing portfolio value, capital flows, P&L, fees, drawdown and strategy performance"
        actions={
          <button className="btn ghost sm" type="button" onClick={exportCsv} disabled={reports.length === 0}>
            Export CSV
          </button>
        }
      >
        <div className="grid cols-3">
          <Field label="Period">
            <div className="tabs">
              {PERIODS.map((p) => (
                <button key={p.value} type="button" className={`tab ${period === p.value ? 'active' : ''}`} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="From">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      {data?.dataQuality?.insufficient && (
        <Banner tone="warn">
          <div>
            <strong>Insufficient data</strong>
            <div>{data.dataQuality.note}</div>
          </div>
        </Banner>
      )}

      {error && <Banner tone="neg">{error}</Banner>}

      {loading ? (
        <Loading label="Generating reports…" />
      ) : reports.length === 0 ? (
        <EmptyState title="No reports for this range" desc="Adjust the period or date range, or record trades to generate reports." />
      ) : (
        <div className="stack">
          {reports.map((r) => (
            <Card key={r.key}>
              <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="row" style={{ gap: 10 }}>
                    <h3 className="card-title">{r.label}</h3>
                    <Badge tone={r.netReturnPct == null ? '' : r.netReturnPct >= 0 ? 'pos' : 'neg'}>
                      {signedPct(r.netReturnPct)}
                    </Badge>
                  </div>
                  <p className="muted" style={{ fontSize: 11.5 }}>
                    {shortDate(r.startDate)} → {shortDate(r.endDate)}
                  </p>
                </div>
                <button className="btn ghost sm" type="button" onClick={() => setExpanded(expanded === r.key ? null : r.key)}>
                  {expanded === r.key ? 'Hide detail' : 'View detail'}
                </button>
              </div>

              <div className="grid cols-3" style={{ marginTop: 14 }}>
                <div>
                  <div className="metric-row"><span className="k">Opening value</span><span className="v">{m(r.openingValue)}</span></div>
                  <div className="metric-row"><span className="k">Closing value</span><span className="v">{m(r.closingValue)}</span></div>
                  <div className="metric-row"><span className="k">Net return</span><span className={`v ${signClass(r.netReturnPct)}`}>{signedPct(r.netReturnPct)}</span></div>
                </div>
                <div>
                  <div className="metric-row"><span className="k">Realized P&L</span><span className={`v ${signClass(r.realizedPnl)}`}>{signedMoney(r.realizedPnl, displayCurrency, fx)}</span></div>
                  <div className="metric-row"><span className="k">Unrealized P&L</span><span className={`v ${signClass(r.unrealizedPnl)}`}>{signedMoney(r.unrealizedPnl, displayCurrency, fx)}</span></div>
                  <div className="metric-row"><span className="k">Fees</span><span className="v">{m(r.fees)}</span></div>
                </div>
                <div>
                  <div className="metric-row"><span className="k">Deposits</span><span className="v">{m(r.deposits)}</span></div>
                  <div className="metric-row"><span className="k">Withdrawals</span><span className="v">{m(r.withdrawals)}</span></div>
                  <div className="metric-row"><span className="k">Drawdown</span><span className="v neg">{pct(r.drawdownPct, 2)}</span></div>
                </div>
              </div>

              {expanded === r.key && (
                <>
                  <div className="divider" />
                  <div className="grid cols-2">
                    <div>
                      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Strategy performance</h4>
                      {r.strategies.length === 0 ? (
                        <p className="muted" style={{ fontSize: 12 }}>No completed trades in this period.</p>
                      ) : (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Strategy</th>
                                <th className="num">Realized</th>
                                <th className="num">Trades</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.strategies.map((s) => (
                                <tr key={s.key}>
                                  <td>{s.key}</td>
                                  <td className={`num ${signClass(s.realized)}`}>{signedMoney(s.realized, displayCurrency, fx)}</td>
                                  <td className="num">{s.trades}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Risk warnings</h4>
                      {r.riskWarnings.length === 0 ? (
                        <p className="muted" style={{ fontSize: 12 }}>No thresholds breached.</p>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)' }}>
                          {r.riskWarnings.map((w) => (
                            <li key={w.code} style={{ marginBottom: 5 }}>
                              <strong>{w.title}</strong> — {w.detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="divider" />
                  <h4 style={{ fontSize: 13, marginBottom: 8 }}>Marco AI analysis</h4>
                  <div className="banner info">
                    <div>
                      <div>{r.marcoAnalysis.text}</div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 11.5 }}>{r.marcoAnalysis.notice}</div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
