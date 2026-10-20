import { useEffect, useMemo, useState } from 'react';
import { Card, Field, Banner, EmptyState } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { num, pct } from '../lib/format.js';

const DEFAULTS = {
  pair: 'BTC/USDT',
  buy_price: 60000,
  quantity: 0.01,
  buy_fee: 0.6,
  sell_fee_pct: 0.1,
  additional_costs: 0,
  target_profit_pct: 5,
};

export default function BreakEven() {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const payload = useMemo(
    () => ({
      pair: form.pair,
      buy_price: Number(form.buy_price),
      quantity: Number(form.quantity),
      buy_fee: Number(form.buy_fee || 0),
      sell_fee_pct: Number(form.sell_fee_pct || 0),
      additional_costs: Number(form.additional_costs || 0),
      target_profit_pct: Number(form.target_profit_pct || 0),
    }),
    [form],
  );

  // Recalculate whenever inputs change.
  useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const data = await api.post('/api/analytics/break-even', payload);
        setResult(data);
        setErrors([]);
      } catch (err) {
        setErrors(err.data?.errors || [err.message]);
        setResult(null);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [payload]);

  const o = result?.outputs;
  const quote = form.pair?.split('/')[1] || 'USDT';

  return (
    <div className="stack">
      <div className="grid cols-1-2">
        <Card title="Trade inputs" desc="All values in the pair's quote currency. Results recalculate as you type.">
          <div className="form-grid">
            <Field label="Trading pair" full>
              <input className="input" value={form.pair} onChange={set('pair')} placeholder="BTC/USDT" />
            </Field>
            <Field label="Buy price">
              <input className="input" type="number" step="any" min="0" value={form.buy_price} onChange={set('buy_price')} />
            </Field>
            <Field label="Quantity">
              <input className="input" type="number" step="any" min="0" value={form.quantity} onChange={set('quantity')} />
            </Field>
            <Field label={`Buy fee (${quote})`} hint="Absolute amount paid to enter">
              <input className="input" type="number" step="any" min="0" value={form.buy_fee} onChange={set('buy_fee')} />
            </Field>
            <Field label="Expected sell fee (%)" hint="Percentage of gross sell proceeds">
              <input className="input" type="number" step="any" min="0" max="99" value={form.sell_fee_pct} onChange={set('sell_fee_pct')} />
            </Field>
            <Field label={`Additional costs (${quote})`} hint="Slippage, funding, transfers…">
              <input className="input" type="number" step="any" min="0" value={form.additional_costs} onChange={set('additional_costs')} />
            </Field>
            <Field label="Target net profit (%)">
              <input className="input" type="number" step="any" value={form.target_profit_pct} onChange={set('target_profit_pct')} />
            </Field>
          </div>
          {errors.length > 0 && (
            <div className="banner neg" style={{ marginTop: 14 }}>
              <div>
                <strong>Check your inputs</strong>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Results" desc={busy ? 'Recalculating…' : 'Deterministic calculation — no estimates'} actions={<span className="badge info">{quote}</span>}>
            {!o ? (
              <EmptyState title="Enter valid inputs" desc="Provide a buy price and quantity greater than zero to see break-even and target prices." />
            ) : (
              <div className="grid cols-2">
                <div>
                  <div className="metric-row"><span className="k">Total acquisition cost</span><span className="v">{num(o.totalAcquisitionCost, 4)}</span></div>
                  <div className="metric-row"><span className="k">Average cost per unit</span><span className="v">{num(o.avgCostPerUnit, 6)}</span></div>
                  <div className="metric-row"><span className="k">Break-even sell price</span><span className="v">{num(o.breakEvenSellPrice, 6)}</span></div>
                  <div className="metric-row"><span className="k">Target sell price</span><span className="v" style={{ color: 'var(--teal)' }}>{num(o.targetSellPrice, 6)}</span></div>
                </div>
                <div>
                  <div className="metric-row"><span className="k">Gross profit at target</span><span className="v pos">{num(o.grossProfit, 4)}</span></div>
                  <div className="metric-row"><span className="k">Total fees</span><span className="v">{num(o.totalFees, 4)}</span></div>
                  <div className="metric-row"><span className="k">Net profit / loss</span><span className={`v ${o.netProfit >= 0 ? 'pos' : 'neg'}`}>{num(o.netProfit, 4)}</span></div>
                  <div className="metric-row"><span className="k">Net return</span><span className={`v ${o.netReturnPct >= 0 ? 'pos' : 'neg'}`}>{pct(o.netReturnPct, 2)}</span></div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Assumptions" desc="How these figures are derived">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)' }}>
              {(result?.assumptions || [
                'Costs are calculated in the quote currency of the pair.',
                'The buy fee and additional costs are added to the acquisition cost.',
                'The expected sell fee is applied as a percentage of gross proceeds.',
                'Break-even assumes a single exit at one price.',
              ]).map((a) => (
                <li key={a} style={{ marginBottom: 6 }}>
                  {a}
                </li>
              ))}
            </ul>
            <div className="divider" />
            <Banner>
              Break-even includes fees and costs you configure. It does not predict market movement — the price still has to reach your
              target.
            </Banner>
          </Card>
        </div>
      </div>
    </div>
  );
}
