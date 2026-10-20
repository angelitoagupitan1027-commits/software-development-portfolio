import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import { Card, KpiCard, Loading, Banner, EmptyState, Badge, DemoBadge } from '../components/ui.jsx';
import { LineChart, BarChart, PALETTE } from '../components/charts.jsx';
import { money, signedMoney, pct, signedPct, signClass, shortDate } from '../lib/format.js';
import { filterSeries, filterPeriods } from '../lib/range.js';

const PERIOD_TABS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Overview() {
  const { range } = useOutletContext();
  const { model, loading, error, fx, displayCurrency } = useData();
  const [tab, setTab] = useState('monthly');

  if (loading && !model) return <Loading label="Loading business snapshot…" />;
  if (error && !model) return <Banner tone="neg">{error}</Banner>;
  if (!model) return null;

  const { kpis, meta, dataQuality, risk } = model;
  const equity = filterSeries(model.equity, range).map((p) => ({ x: shortDate(p.date), y: p.equity }));
  const fees = filterSeries(model.fees, range).map((p) => ({ x: shortDate(p.date), y: p.fees }));
  const periods = filterPeriods(model.periods[tab], range, tab).map((p) => ({
    label: tab === 'monthly' ? p.key.slice(2) : p.key.slice(5),
    value: p.value,
  }));

  const m = (v) => money(v, displayCurrency, fx);

  return (
    <div className="stack">
      {dataQuality.insufficient && (
        <Banner tone="warn">
          <div>
            <strong>Insufficient data</strong>
            <div>{dataQuality.note} KPIs marked as unreliable are calculated from {dataQuality.closedTrades} completed trade(s).</div>
          </div>
        </Banner>
      )}

      <div className="grid kpi">
        <KpiCard label="Initial Capital" value={m(kpis.initialCapital)} sub="Configured starting capital" />
        <KpiCard
          label="Current Portfolio Value"
          value={m(kpis.portfolioValue)}
          sub={`Cash + priced holdings · 1 USDT = ${meta.fxRate} PHP`}
          badge={meta.demoMode ? <DemoBadge /> : null}
        />
        <KpiCard
          label="Realized Profit / Loss"
          value={signedMoney(kpis.realizedPnl, displayCurrency, fx)}
          tone={signClass(kpis.realizedPnl)}
          sub={`From ${kpis.closedTrades} completed trades`}
        />
        <KpiCard
          label="Unrealized Profit / Loss"
          value={signedMoney(kpis.unrealizedPnl, displayCurrency, fx)}
          tone={signClass(kpis.unrealizedPnl)}
          sub={dataQuality.unpricedHoldings ? `${dataQuality.unpricedHoldings} holding(s) without a price` : 'Open positions at market price'}
        />
        <KpiCard label="Total Trading Fees" value={m(kpis.totalFees)} sub="All recorded fees, converted to reporting currency" />
        <KpiCard label="Available Cash Balance" value={m(kpis.availableCash)} sub={`${risk.cashPct}% of portfolio value`} />
        <KpiCard
          label="Win Rate"
          value={kpis.winRate == null ? '—' : pct(kpis.winRate, 1)}
          tone={kpis.winRate == null ? '' : signClass(kpis.winRate - 50)}
          sub={dataQuality.insufficient ? 'Insufficient data' : `${kpis.closedTrades} completed trades`}
        />
        <KpiCard
          label="Maximum Drawdown"
          value={pct(kpis.maxDrawdown, 2)}
          tone={kpis.maxDrawdown > 0 ? 'neg' : ''}
          sub={model.drawdown.troughDate ? `Trough ${shortDate(model.drawdown.troughDate)}` : 'Peak-to-trough on book equity'}
        />
      </div>

      <div className="grid cols-2-1">
        <Card title="Portfolio equity over time" desc="Book equity = cash + cost basis of holdings (excludes unrealized revaluation)">
          <LineChart data={equity} formatValue={(v) => m(v)} />
        </Card>
        <Card title="Realized vs unrealized" desc="Kept strictly separate from deposits and withdrawals">
          <div className="stack" style={{ gap: 10 }}>
            <div>
              <div className="row between" style={{ fontSize: 12.5 }}>
                <span className="muted">Realized P&L</span>
                <strong className={signClass(kpis.realizedPnl)}>{signedMoney(kpis.realizedPnl, displayCurrency, fx)}</strong>
              </div>
              <div className="bar-track" style={{ marginTop: 6 }}>
                <div className="bar-fill" style={{ width: `${Math.min(100, Math.abs(kpis.realizedPnl) / Math.max(1, Math.abs(kpis.realizedPnl) + Math.abs(kpis.unrealizedPnl)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="row between" style={{ fontSize: 12.5 }}>
                <span className="muted">Unrealized P&L</span>
                <strong className={signClass(kpis.unrealizedPnl)}>{signedMoney(kpis.unrealizedPnl, displayCurrency, fx)}</strong>
              </div>
              <div className="bar-track" style={{ marginTop: 6 }}>
                <div className="bar-fill" style={{ width: `${Math.min(100, Math.abs(kpis.unrealizedPnl) / Math.max(1, Math.abs(kpis.realizedPnl) + Math.abs(kpis.unrealizedPnl)) * 100)}%` }} />
              </div>
            </div>
            <div className="divider" />
            <div className="row between" style={{ fontSize: 12.5 }}>
              <span className="muted">Deposits (not profit)</span>
              <span>{m(kpis.deposits)}</span>
            </div>
            <div className="row between" style={{ fontSize: 12.5 }}>
              <span className="muted">Withdrawals</span>
              <span>{m(kpis.withdrawals)}</span>
            </div>
            <div className="row between" style={{ fontSize: 12.5 }}>
              <span className="muted">Trading P&L vs contributions</span>
              <strong className={signClass(kpis.tradingPnl)}>{signedMoney(kpis.tradingPnl, displayCurrency, fx)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid cols-2-1">
        <Card
          title="Profit & loss by period"
          desc="Realized P&L grouped by trade close date"
          actions={
            <div className="tabs">
              {PERIOD_TABS.map((t) => (
                <button key={t.value} type="button" className={`tab ${tab === t.value ? 'active' : ''}`} onClick={() => setTab(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          <BarChart data={periods} formatValue={(v) => m(v)} />
        </Card>
        <Card title="Trading fees over time" desc="Cumulative fees paid, converted at the reporting FX rate">
          <LineChart data={fees} color="var(--teal)" formatValue={(v) => m(v)} />
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Strategy performance" desc="Realized P&L by strategy, from completed trades">
          {model.byStrategy.length === 0 ? (
            <EmptyState title="No completed trades yet" desc="Strategy performance appears once trades are recorded and closed." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Strategy</th>
                    <th className="num">Realized</th>
                    <th className="num">Trades</th>
                    <th className="num">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {model.byStrategy.slice(0, 6).map((s, i) => (
                    <tr key={s.key}>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <span className="swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {s.key}
                        </span>
                      </td>
                      <td className={`num ${signClass(s.realized)}`}>{signedMoney(s.realized, displayCurrency, fx)}</td>
                      <td className="num">{s.trades}</td>
                      <td className="num">{s.winRate == null ? '—' : pct(s.winRate, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Risk summary" desc="Advisory only — losses cannot always be prevented">
          {risk.warnings.length === 0 ? (
            <EmptyState title="No thresholds breached" desc="All monitored limits are currently within range." />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {risk.warnings.slice(0, 5).map((w) => (
                <div key={w.code} className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{w.title}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{w.detail}</div>
                  </div>
                  <Badge tone={w.level === 'high' ? 'neg' : w.level === 'medium' ? 'demo' : 'info'}>{w.level}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Business summary" desc="Verified metrics only — no estimates or fabricated performance">
        <div className="grid cols-3">
          <div>
            <div className="metric-row"><span className="k">Net return on contributions</span><span className={`v ${signClass(kpis.netReturnPct)}`}>{signedPct(kpis.netReturnPct)}</span></div>
            <div className="metric-row"><span className="k">Average winning trade</span><span className="v pos">{money(kpis.avgWin, displayCurrency, fx)}</span></div>
            <div className="metric-row"><span className="k">Average losing trade</span><span className="v neg">{money(kpis.avgLoss, displayCurrency, fx)}</span></div>
          </div>
          <div>
            <div className="metric-row"><span className="k">Profit factor</span><span className="v">{kpis.profitFactor == null ? 'Insufficient data' : kpis.profitFactor}</span></div>
            <div className="metric-row"><span className="k">Open positions</span><span className="v">{kpis.openPositions}</span></div>
            <div className="metric-row"><span className="k">Records on file</span><span className="v">{meta.tradeCount}</span></div>
          </div>
          <div>
            <div className="metric-row"><span className="k">Invested exposure</span><span className="v">{pct(risk.exposurePct, 1)}</span></div>
            <div className="metric-row"><span className="k">Top concentration</span><span className="v">{risk.concentrationSymbol ? `${risk.concentrationSymbol} ${pct(risk.concentrationPct, 1)}` : '—'}</span></div>
            <div className="metric-row"><span className="k">FX rate used</span><span className="v">{meta.fxRate} PHP / USDT</span></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
