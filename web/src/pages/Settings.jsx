import { useEffect, useState } from 'react';
import { Card, Field, Banner, Badge, Loading } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { relativeTime, shortDateTime, num } from '../lib/format.js';

export default function Settings() {
  const { model, refresh } = useData();
  const [settings, setSettings] = useState(null);
  const [okx, setOkx] = useState(null);
  const [prices, setPrices] = useState([]);
  const [newPrice, setNewPrice] = useState({ symbol: '', price_usdt: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    const [s, o, p] = await Promise.all([api.get('/api/settings'), api.get('/api/okx/status'), api.get('/api/settings/prices')]);
    setSettings(s.settings);
    setOkx(o);
    setPrices(p.prices);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data = await api.put('/api/settings', {
        initial_capital: Number(settings.initial_capital),
        base_currency: settings.base_currency,
        demo_mode: settings.demo_mode,
        fx_rate: { rate: Number(settings.fx_rate?.rate), source: 'manual' },
      });
      setSettings(data.settings);
      setMessage('Settings saved.');
      await refresh();
    } catch (e) {
      setError(e.data?.errors?.join(' ') || e.message);
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async () => {
    setError(null);
    try {
      const data = await api.post('/api/settings/prices', { symbol: newPrice.symbol, price_usdt: Number(newPrice.price_usdt) });
      setPrices(data.prices);
      setNewPrice({ symbol: '', price_usdt: '' });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const syncOkx = async () => {
    setError(null);
    setMessage(null);
    try {
      await api.post('/api/okx/sync');
      setMessage('OKX synchronization completed.');
    } catch (e) {
      setError(e.message);
    } finally {
      setOkx(await api.get('/api/okx/status'));
    }
  };

  const disconnectOkx = async () => {
    await api.post('/api/okx/disconnect');
    setOkx(await api.get('/api/okx/status'));
    setMessage('OKX connection cleared locally.');
  };

  if (!settings) return <Loading label="Loading settings…" />;

  return (
    <div className="stack">
      {message && <Banner tone="info">{message}</Banner>}
      {error && <Banner tone="neg">{error}</Banner>}

      <div className="grid cols-2">
        <Card
          title="Capital & reporting currency"
          desc="Initial capital is the baseline used for return calculations. Deposits are never counted as profit."
          actions={
            <button className="btn primary sm" type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Initial capital (PHP)">
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                value={settings.initial_capital ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, initial_capital: e.target.value }))}
              />
            </Field>
            <Field label="Reporting currency">
              <select
                className="select"
                style={{ width: '100%' }}
                value={settings.base_currency}
                onChange={(e) => setSettings((s) => ({ ...s, base_currency: e.target.value }))}
              >
                <option value="PHP">PHP (₱)</option>
                <option value="USDT">USDT</option>
              </select>
            </Field>
            <Field label="Exchange rate — PHP per 1 USDT" hint={`Last updated ${shortDateTime(settings.fx_rate?.updated_at)} (${relativeTime(settings.fx_rate?.updated_at)})`}>
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                value={settings.fx_rate?.rate ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, fx_rate: { ...(s.fx_rate || {}), rate: e.target.value } }))}
              />
            </Field>
            <div className="row between" style={{ paddingTop: 4 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>Demo mode</div>
                <div className="muted" style={{ fontSize: 11.5 }}>Include clearly labelled sample records in all calculations and charts.</div>
              </div>
              <button
                className={`btn sm ${settings.demo_mode ? 'teal' : 'ghost'}`}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, demo_mode: !s.demo_mode }))}
              >
                {settings.demo_mode ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </Card>

        <Card title="Market prices" desc="Manual prices used to value holdings. Prices are stored per asset in USDT.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="num">Price (USDT)</th>
                  <th>Source</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.symbol}>
                    <td><strong>{p.symbol}</strong></td>
                    <td className="num">{num(p.price_usdt, 4)}</td>
                    <td>{p.is_demo ? <Badge tone="demo">DEMO</Badge> : <Badge tone="teal">{p.source}</Badge>}</td>
                    <td className="muted">{relativeTime(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" placeholder="BTC" value={newPrice.symbol} onChange={(e) => setNewPrice((v) => ({ ...v, symbol: e.target.value.toUpperCase() }))} />
            <input className="input" type="number" step="any" placeholder="68200" value={newPrice.price_usdt} onChange={(e) => setNewPrice((v) => ({ ...v, price_usdt: e.target.value }))} />
            <button className="btn sm" type="button" onClick={savePrice} disabled={!newPrice.symbol || !newPrice.price_usdt}>
              Save price
            </button>
          </div>
        </Card>
      </div>

      <Card
        title="OKX Spot integration"
        desc="Read-only connection status. Withdrawal permissions are never requested or used."
        actions={
          <div className="row">
            <Badge tone={okx?.status === 'connected' ? 'pos' : okx?.status === 'error' ? 'neg' : ''}>
              {okx?.status === 'connected' ? 'Connected' : okx?.status === 'error' ? 'Error' : 'Not connected'}
            </Badge>
          </div>
        }
      >
        <div className="grid cols-2">
          <div>
            <div className="metric-row"><span className="k">Credentials configured on server</span><span className="v">{okx?.configured ? 'Yes' : 'No'}</span></div>
            <div className="metric-row"><span className="k">API key</span><span className="v mono">{okx?.api_key_masked || '—'}</span></div>
            <div className="metric-row"><span className="k">Last successful sync</span><span className="v">{okx?.last_sync ? shortDateTime(okx.last_sync) : 'Never'}</span></div>
            <div className="metric-row"><span className="k">Reconciliation</span><span className="v">{okx?.reconciliation === 'match' ? 'Matched' : okx?.reconciliation === 'mismatch' ? 'Discrepancy detected' : 'Not run'}</span></div>
            <div className="metric-row"><span className="k">Last error</span><span className="v neg">{okx?.last_error || 'None'}</span></div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <Banner>
              <div>
                The first release uses manual entry and CSV import. A secure backend integration runs only when read-only OKX credentials are
                stored as app secrets. The application never reports a connection that does not exist.
              </div>
            </Banner>
            {okx?.balances?.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Currency</th>
                      <th className="num">Equity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {okx.balances.map((b) => (
                      <tr key={b.currency}>
                        <td>{b.currency}</td>
                        <td className="num">{num(b.equity, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row">
              <button className="btn sm" type="button" onClick={syncOkx}>
                Test / sync now
              </button>
              <button className="btn ghost sm" type="button" onClick={disconnectOkx}>
                Clear status
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Data integrity" desc="How records and calculations are kept consistent">
        <div className="grid cols-2">
          <div>
            <div className="metric-row"><span className="k">Records on file</span><span className="v">{model?.meta?.tradeCount ?? '—'}</span></div>
            <div className="metric-row"><span className="k">Completed trades</span><span className="v">{model?.dataQuality?.closedTrades ?? '—'}</span></div>
            <div className="metric-row"><span className="k">Duplicate protection</span><span className="v">Order + time + pair + side + qty + price</span></div>
          </div>
          <div>
            <div className="metric-row"><span className="k">Realized P&L</span><span className="v">Separate from unrealized</span></div>
            <div className="metric-row"><span className="k">Deposits & withdrawals</span><span className="v">Never counted as trading profit</span></div>
            <div className="metric-row"><span className="k">Calculation engine</span><span className="v">Deterministic application code</span></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
