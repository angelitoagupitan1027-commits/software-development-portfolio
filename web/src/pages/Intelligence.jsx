import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, KpiCard, Loading, Banner, EmptyState } from '../components/ui.jsx';
import { LineChart, BarChart, DonutChart, PALETTE } from '../components/charts.jsx';
import { useData } from '../context/DataContext.jsx';
import { money, signedMoney, pct, signedPct, signClass, shortDate } from '../lib/format.js';
import { filterSeries, filterPeriods } from '../lib/range.js';

const PERIOD_TABS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Intelligence() {
  const { range } = useOutletContext();
  const { model, loading, error, fx, displayCurrency } = useData();
  const [tab, setTab] = useState('monthly');

  if (loading && !model) return <Loading label="Building business intelligence…" />;
  if (error && !model) return <Banner tone="neg">{error}</Banner>;
  if (!model) return null;

  const { kpis, dataQuality, meta } = model;
  const m = (v) => money(v, displayCurrency, fx);

  const equity = filterSeries(model.equity, range).map((p) => ({ x: shortDate(p.date), y: p.equity }));
  const fees = filterSeries(model.fees, range).map((p) => ({ x: shortDate(p.date), y: p.fees }));
  const pnl = filterPeriods(model.periods[tab], range, tab).map((p) => ({ label: tab === 'monthly' ? p.key.slice(2) : p.key.slice(5), value: p.value }));
  const feePeriods = filterPeriods(model.periods[`fees${tab[0].toUpperCase()}${tab.slice(1)}`], range, tab).map((p) => ({
    label: tab === 'monthly' ? p.key.slice(2) : p.key.slice(5),
    value: p.value,
  }));

  const pnlSplit = [
    { label: 'Realized', value: Math.max(0, kpis.realizedPnl || 0), color: PALETTE[0] },
    { label: 'Unrealized', value: Math.max(0, kpis.unrealizedPnl || 0), color: PALETTE[1] },
  ].filter((d) => d.value > 0);

  const coinChart = model.byCoin.map((c) => ({ label: c.key, value: c.realized }));

  return (
    <div className="stack">
      {dataQuality.insufficient && (
        <Banner tone="warn">
          <div>
            <strong>Insufficient data</strong>
            <div>{dataQuality.note} KPI cards below will show “Insufficient data” where a reliable figure cannot be produced.</div>
          </div>
        </Banner>
      )}

      <div className="grid kpi">
        <KpiCard label="Portfolio equity" value={m(kpis.portfolioValue)} sub={`As of ${shortDate(meta.generatedAt)}`} />
        <KpiCard label="Net return" value={signedPct(kpis.netReturnPct)} tone={signClass(kpis.netReturnPct)} sub="On capital contributed" />
        <KpiCard label="Win rate" value={kpis.winRate == null ? 'Insufficient data' : pct(kpis.winRate, 1)} sub={`${kpis.closedTrades} completed trades`} />
        <KpiCard label="Profit factor" value={kpis.profitFactor == null ? 'Insufficient data' : kpis.profitFactor} sub="Gross profit ÷ gross loss" />
        <KpiCard label="Average winning trade" value={kpis.avgWin == null ? 'Insufficient data' : m(kpis.avgWin)} tone={kpis.avgWin == null ? '' : 'pos'} sub={`${kpis.closedTrades} closed trades`} />
        <KpiCard label="Average losing trade" value={kpis.avgLoss == null ? 'Insufficient data' : m(kpis.avgLoss)} tone={kpis.avgLoss == null ? '' : 'neg'} sub="Mean loss per losing trade" />
        <KpiCard label="Maximum drawdown" value={pct(kpis.maxDrawdown, 2)} tone={kpis.maxDrawdown > 0 ? 'neg' : ''} sub={model.drawdown.peakDate ? `From peak ${shortDate(model.drawdown.peakDate)}` : '—'} />
        <KpiCard label="Total fees paid" value={m(kpis.totalFees)} sub="All recorded trading fees" />
      </div>

      <div className="grid cols-2-1">
        <Card title="Portfolio equity over time" desc="Book equity from stored records">
          <LineChart data={equity} formatValue={(v) => m(v)} />
        </Card>
        <Card title="Realized vs unrealized" desc="Never mixed with deposits or withdrawals">
          <DonutChart data={pnlSplit} formatValue={(v) => m(v)} />
          <div className="divider" />
          <div className="metric-row"><span className="k">Realized</span><span className={`v ${signClass(kpis.realizedPnl)}`}>{signedMoney(kpis.realizedPnl, displayCurrency, fx)}</span></div>
          <div className="metric-row"><span className="k">Unrealized</span><span className={`v ${signClass(kpis.unrealizedPnl)}`}>{signedMoney(kpis.unrealizedPnl, displayCurrency, fx)}</span></div>
          <div className="metric-row"><span className="k">Deposits (not profit)</span><span className="v">{m(kpis.deposits)}</span></div>
        </Card>
      </div>

      <Card
        title="Profit & loss by period"
        desc="Realized P&L grouped by close date"
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
        {pnl.length === 0 ? <EmptyState title="Insufficient data" desc="No completed trades in the selected range." /> : <BarChart data={pnl} formatValue={(v) => m(v)} />}
      </Card>

      <div className="grid cols-2">
        <Card title="Trading fees over time" desc="Cumulative fees">
          <LineChart data={fees} color="var(--teal)" formatValue={(v) => m(v)} />
        </Card>
        <Card title={`Fees by ${tab} period`} desc="Fee cost per period">
          {feePeriods.length === 0 ? <EmptyState title="No fees recorded" desc="Fees appear as trades are recorded." /> : <BarChart data={feePeriods} formatValue={(v) => m(v)} posColor="var(--teal)" negColor="var(--teal)" />}
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Performance by coin" desc="Realized P&L per asset">
          {coinChart.length === 0 ? <EmptyState title="Insufficient data" desc="No completed trades by coin yet." /> : <BarChart data={coinChart} formatValue={(v) => m(v)} />}
        </Card>
        <Card title="Performance by strategy" desc="Realized P&L per strategy">
          {model.byStrategy.length === 0 ? (
            <EmptyState title="Insufficient data" desc="No completed trades by strategy yet." />
          ) : (
            <BarChart data={model.byStrategy.map((s) => ({ label: s.key, value: s.realized }))} formatValue={(v) => m(v)} />
          )}
        </Card>
      </div>

      <Card title="KPI definitions & data quality" desc="How each figure is produced">
        <div className="grid cols-2">
          <div>
            <div className="metric-row"><span className="k">Win rate</span><span className="v">Winning closed trades ÷ all closed trades</span></div>
            <div className="metric-row"><span className="k">Profit factor</span><span className="v">Gross profit ÷ gross loss</span></div>
            <div className="metric-row"><span className="k">Maximum drawdown</span><span className="v">Largest peak-to-trough decline on book equity</span></div>
          </div>
          <div>
            <div className="metric-row"><span className="k">Completed trades</span><span className="v">{dataQuality.closedTrades}</span></div>
            <div className="metric-row"><span className="k">Unpriced holdings</span><span className="v">{dataQuality.unpricedHoldings}</span></div>
            <div className="metric-row"><span className="k">Stale / missing prices</span><span className="v">{dataQuality.stalePriceCount}</span></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
