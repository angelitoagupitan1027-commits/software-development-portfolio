import { useData } from '../context/DataContext.jsx';
import { Card, KpiCard, Loading, Banner, EmptyState, DemoBadge } from '../components/ui.jsx';
import { DonutChart, PALETTE } from '../components/charts.jsx';
import { money, signedMoney, pct, signClass, shortDateTime, relativeTime, num } from '../lib/format.js';

export default function Portfolio() {
  const { model, loading, error, fx, displayCurrency } = useData();

  if (loading && !model) return <Loading label="Loading portfolio…" />;
  if (error && !model) return <Banner tone="neg">{error}</Banner>;
  if (!model) return null;

  const { positions, kpis, meta, risk, dataQuality } = model;
  const m = (v) => money(v, displayCurrency, fx);
  const allocation = positions
    .filter((p) => p.marketValuePhp != null)
    .map((p, i) => ({ label: p.symbol, value: p.marketValuePhp, color: PALETTE[i % PALETTE.length] }));

  return (
    <div className="stack">
      <div className="banner info">
        <div>
          <strong>Currency conversion</strong>
          <div>
            1 USDT = <span className="mono">{meta.fxRate}</span> PHP · rate updated {shortDateTime(meta.fxUpdatedAt)} ({relativeTime(meta.fxUpdatedAt)})
            · source: {meta.fxSource}. Holdings are quoted in USDT and converted at this rate.
          </div>
        </div>
      </div>

      <div className="grid kpi">
        <KpiCard label="Holdings market value" value={m(kpis.portfolioValue - kpis.availableCash)} sub="Priced open positions" badge={meta.demoMode ? <DemoBadge /> : null} />
        <KpiCard label="Available cash" value={m(kpis.availableCash)} sub={`${risk.cashPct}% of portfolio value`} />
        <KpiCard label="Unrealized P&L" value={signedMoney(kpis.unrealizedPnl, displayCurrency, fx)} tone={signClass(kpis.unrealizedPnl)} sub="Marked at current prices" />
        <KpiCard label="Invested exposure" value={pct(risk.exposurePct, 1)} sub={`Top: ${risk.concentrationSymbol || '—'} ${pct(risk.concentrationPct, 1)}`} />
      </div>

      {dataQuality.unpricedHoldings > 0 && (
        <Banner tone="warn">
          <div>
            <strong>Missing market data</strong>
            <div>{dataQuality.unpricedHoldings} holding(s) have no market price, so their market value and unrealized P&L cannot be computed. Add prices in Settings.</div>
          </div>
        </Banner>
      )}

      <div className="grid cols-1-2">
        <Card title="Allocation by asset" desc="Share of priced holdings by market value">
          <DonutChart data={allocation} formatValue={(v) => m(v)} />
        </Card>

        <Card title="Holdings" desc="Quantity, average entry, current price, market value and unrealized P&L">
          {positions.length === 0 ? (
            <EmptyState
              title="No holdings"
              desc="No open positions are recorded. Add trades in the Trade Ledger or import a CSV to build your portfolio."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th className="num">Quantity</th>
                    <th className="num">Avg entry (PHP)</th>
                    <th className="num">Market price (USDT)</th>
                    <th className="num">Market value</th>
                    <th className="num">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.symbol}</div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {p.marketPriceUsdt == null ? 'no price' : p.priceIsDemo ? 'DEMO price' : `updated ${relativeTime(p.priceUpdatedAt)}`}
                        </div>
                      </td>
                      <td className="num">{num(p.quantity, 6)}</td>
                      <td className="num">{money(p.avgCostPhp, displayCurrency, fx)}</td>
                      <td className="num">{p.marketPriceUsdt == null ? '—' : num(p.marketPriceUsdt, 4)}</td>
                      <td className="num">{p.marketValuePhp == null ? '—' : m(p.marketValuePhp)}</td>
                      <td className={`num ${signClass(p.unrealizedPhp)}`}>
                        {p.unrealizedPhp == null ? '—' : signedMoney(p.unrealizedPhp, displayCurrency, fx)}
                        {p.unrealizedPct != null && <div style={{ fontSize: 11, opacity: 0.85 }}>{pct(p.unrealizedPct, 2)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
