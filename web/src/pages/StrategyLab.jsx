import { useEffect, useState } from 'react';
import { Card, Loading, Banner, EmptyState, Field, Badge } from '../components/ui.jsx';
import { BarChart, PALETTE } from '../components/charts.jsx';
import { useData } from '../context/DataContext.jsx';
import { api } from '../lib/api.js';
import { money, signedMoney, pct, signClass } from '../lib/format.js';

export default function StrategyLab() {
  const { model, loading, error, fx, displayCurrency, refresh } = useData();
  const [notes, setNotes] = useState({});
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (model?.settings?.strategy_notes) setNotes(model.settings.strategy_notes);
  }, [model?.settings?.strategy_notes]);

  if (loading && !model) return <Loading label="Loading strategies…" />;
  if (error && !model) return <Banner tone="neg">{error}</Banner>;
  if (!model) return null;

  const strategies = model.byStrategy;
  const chartData = strategies.map((s) => ({ label: s.key, value: s.realized }));

  const saveNotes = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/settings', { strategy_notes: notes });
      setSaved(true);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      {model.dataQuality.insufficient && (
        <Banner tone="warn">
          <div>
            <strong>Insufficient data</strong>
            <div>{model.dataQuality.note} Strategy comparisons below are indicative only.</div>
          </div>
        </Banner>
      )}

      <div className="grid cols-2-1">
        <Card title="Realized P&L by strategy" desc="Derived from completed (sell) trades">
          <BarChart data={chartData} formatValue={(v) => money(v, displayCurrency, fx)} />
        </Card>
        <Card title="Strategy review notes" desc="Your written assessment of each approach">
          {strategies.length === 0 ? (
            <EmptyState title="No strategies yet" desc="Assign a strategy name to trades in the Trade Ledger." />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              <Field label="Strategy">
                <select className="select" style={{ width: '100%' }} value={active || strategies[0].key} onChange={(e) => setActive(e.target.value)}>
                  {strategies.map((s) => (
                    <option key={s.key} value={s.key}>{s.key}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <textarea
                  className="textarea"
                  style={{ minHeight: 120 }}
                  value={notes[active || strategies[0].key] || ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [active || strategies[0].key]: e.target.value }))}
                  placeholder="What worked, what to change, market conditions…"
                />
              </Field>
              <div className="row between">
                <span className="muted" style={{ fontSize: 11.5 }}>{saved ? 'Saved' : 'Not saved yet'}</span>
                <button className="btn primary sm" type="button" onClick={saveNotes} disabled={saving}>
                  {saving ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Strategy performance" desc="Verified metrics per strategy">
        {strategies.length === 0 ? (
          <EmptyState title="No strategy data" desc="Record trades with a strategy name to compare approaches." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th className="num">Realized P&L</th>
                  <th className="num">Closed trades</th>
                  <th className="num">Wins</th>
                  <th className="num">Losses</th>
                  <th className="num">Win rate</th>
                  <th className="num">Fees</th>
                  <th className="num">Turnover</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, i) => (
                  <tr key={s.key}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <strong>{s.key}</strong>
                      </span>
                    </td>
                    <td className={`num ${signClass(s.realized)}`}>{signedMoney(s.realized, displayCurrency, fx)}</td>
                    <td className="num">{s.trades}</td>
                    <td className="num pos">{s.wins}</td>
                    <td className="num neg">{s.losses}</td>
                    <td className="num">{s.winRate == null ? '—' : pct(s.winRate, 1)}</td>
                    <td className="num">{money(s.feesPhp, displayCurrency, fx)}</td>
                    <td className="num">{money(s.volumePhp, displayCurrency, fx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Performance by coin" desc="Realized P&L per asset">
        {model.byCoin.length === 0 ? (
          <EmptyState title="No closed trades yet" desc="Coin-level performance appears once positions are sold." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="num">Realized P&L</th>
                  <th className="num">Closed trades</th>
                  <th className="num">Win rate</th>
                  <th className="num">Fees</th>
                </tr>
              </thead>
              <tbody>
                {model.byCoin.map((c) => (
                  <tr key={c.key}>
                    <td><strong>{c.key}</strong></td>
                    <td className={`num ${signClass(c.realized)}`}>{signedMoney(c.realized, displayCurrency, fx)}</td>
                    <td className="num">{c.trades}</td>
                    <td className="num">{c.winRate == null ? '—' : pct(c.winRate, 1)}</td>
                    <td className="num">{money(c.feesPhp, displayCurrency, fx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
