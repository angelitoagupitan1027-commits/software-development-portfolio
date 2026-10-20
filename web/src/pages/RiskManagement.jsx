import { useEffect, useState } from 'react';
import { Card, Loading, Banner, EmptyState, Field, Badge, MetricRow } from '../components/ui.jsx';
import { useData } from '../context/DataContext.jsx';
import { api } from '../lib/api.js';
import { money, signedMoney, pct, signClass } from '../lib/format.js';

const FIELDS = [
  ['max_position_pct', 'Max single-position concentration (%)', 'Warn when one asset exceeds this share of portfolio value.'],
  ['large_position_pct', 'Large position threshold (%)', 'Flag positions above this share as unusually large.'],
  ['max_daily_loss_pct', 'Max daily loss (%)', 'Warn when realized P&L for the day falls below this.'],
  ['max_monthly_loss_pct', 'Max monthly loss (%)', 'Warn when realized P&L for the month falls below this.'],
  ['max_drawdown_pct', 'Max drawdown (%)', 'Warn when peak-to-trough equity drawdown exceeds this.'],
  ['min_cash_pct', 'Minimum cash reserve (%)', 'Warn when available cash falls below this share.'],
  ['stale_price_hours', 'Stale price age (hours)', 'Treat market data older than this as stale.'],
];

export default function RiskManagement() {
  const { model, loading, error, fx, displayCurrency, refresh } = useData();
  const [risk, setRisk] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (model?.risk?.thresholds) setRisk(model.risk.thresholds);
  }, [model?.risk?.thresholds]);

  if (loading && !model) return <Loading label="Loading risk panel…" />;
  if (error && !model) return <Banner tone="neg">{error}</Banner>;
  if (!model) return null;

  const { risk: r, kpis } = model;
  const m = (v) => money(v, displayCurrency, fx);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/settings', { risk });
      setSaved(true);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const toneFor = (value, limit, invert) => {
    if (value == null || limit == null) return '';
    const breached = invert ? value < limit : value > limit;
    return breached ? 'neg' : 'pos';
  };

  return (
    <div className="stack">
      <Banner tone="warn">
        <div>
          <strong>Advisory only</strong>
          <div>{r.disclaimer}</div>
        </div>
      </Banner>

      <div className="grid cols-3">
        <Card title="Exposure & concentration">
          <MetricRow label="Invested exposure" value={pct(r.exposurePct, 1)} />
          <MetricRow label="Top holding" value={r.concentrationSymbol ? `${r.concentrationSymbol} · ${pct(r.concentrationPct, 1)}` : '—'} tone={toneFor(r.concentrationPct, r.thresholds.max_position_pct)} />
          <MetricRow label="Available cash" value={`${m(kpis.availableCash)} (${pct(r.cashPct, 1)})`} tone={toneFor(r.cashPct, r.thresholds.min_cash_pct, true)} />
        </Card>

        <Card title="Loss limits">
          <MetricRow label="Realized P&L today" value={signedMoney(r.dayPnl, displayCurrency, fx)} tone={signClass(r.dayPnl)} />
          <MetricRow label="vs daily limit" value={pct(r.dayPnlPct, 2)} tone={toneFor(r.dayPnlPct, -Math.abs(r.thresholds.max_daily_loss_pct), true)} />
          <MetricRow label="Realized P&L this month" value={signedMoney(r.monthPnl, displayCurrency, fx)} tone={signClass(r.monthPnl)} />
          <MetricRow label="vs monthly limit" value={pct(r.monthPnlPct, 2)} tone={toneFor(r.monthPnlPct, -Math.abs(r.thresholds.max_monthly_loss_pct), true)} />
        </Card>

        <Card title="Drawdown & data integrity">
          <MetricRow label="Maximum drawdown" value={pct(r.drawdownPct, 2)} tone={toneFor(r.drawdownPct, r.thresholds.max_drawdown_pct)} />
          <MetricRow label="Unusually large positions" value={r.largePositions.length === 0 ? 'None' : r.largePositions.map((p) => `${p.symbol} ${p.pct}%`).join(', ')} tone={r.largePositions.length ? 'neg' : 'pos'} />
          <MetricRow label="Missing / stale market data" value={r.stalePrices.length === 0 ? 'None' : r.stalePrices.map((s) => `${s.symbol} (${s.reason})`).join(', ')} tone={r.stalePrices.length ? 'neg' : 'pos'} />
          <MetricRow label="Account reconciliation" value={model.okx?.reconciliation === 'match' ? 'Matched' : model.okx?.reconciliation === 'mismatch' ? 'Discrepancy' : 'Not run'} tone={model.okx?.reconciliation === 'mismatch' ? 'neg' : ''} />
        </Card>
      </div>

      <div className="grid cols-1-2">
        <Card
          title="Risk thresholds"
          desc="Configure the limits used for advisory alerts"
          actions={
            <button className="btn primary sm" type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save limits'}
            </button>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            {FIELDS.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint}>
                <input
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  value={risk[key] ?? ''}
                  onChange={(e) => setRisk((s) => ({ ...s, [key]: Number(e.target.value) }))}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Active alerts" desc="Thresholds currently breached">
          {r.warnings.length === 0 ? (
            <EmptyState title="No alerts" desc="All configured limits are within range." />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {r.warnings.map((w) => (
                <div key={w.code} className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{w.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{w.detail}</div>
                  </div>
                  <Badge tone={w.level === 'high' ? 'neg' : w.level === 'medium' ? 'demo' : 'info'}>{w.level}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
