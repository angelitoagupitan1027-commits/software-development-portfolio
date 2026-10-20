import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Field, Modal, Banner, EmptyState, Loading, Badge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { num, shortDateTime, toLocalInput, signClass, money } from '../lib/format.js';
import { useData } from '../context/DataContext.jsx';

const EMPTY_FORM = {
  trade_datetime: toLocalInput(),
  pair: 'BTC/USDT',
  side: 'buy',
  quantity: '',
  price: '',
  fee: '0',
  fee_currency: 'USDT',
  order_id: '',
  notes: '',
  strategy: '',
};

export default function TradeLedger() {
  const { refresh, fx, displayCurrency } = useData();
  const [filters, setFilters] = useState({ q: '', pair: '', side: '', strategy: '', fee_currency: '', from: '', to: '' });
  const [trades, setTrades] = useState([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState({ pairs: [], strategies: [], feeCurrencies: [] });
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'import' | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [duplicate, setDuplicate] = useState(null);
  const [importText, setImportText] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const [list, metaData, auditData] = await Promise.all([
        api.get(`/api/trades?${params.toString()}`),
        api.get('/api/trades/meta'),
        api.get('/api/trades/audit'),
      ]);
      setTrades(list.trades);
      setTotal(list.total);
      setMeta(metaData);
      setAudit(auditData.entries);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, trade_datetime: toLocalInput() });
    setEditingId(null);
    setFormErrors([]);
    setDuplicate(null);
    setModal('create');
  };

  const openEdit = (t) => {
    setForm({
      trade_datetime: toLocalInput(t.trade_datetime),
      pair: t.pair,
      side: t.side,
      quantity: String(t.quantity),
      price: String(t.price),
      fee: String(t.fee),
      fee_currency: t.fee_currency,
      order_id: t.order_id || '',
      notes: t.notes || '',
      strategy: t.strategy || '',
    });
    setEditingId(t.id);
    setFormErrors([]);
    setDuplicate(null);
    setModal('edit');
  };

  const submit = async (force = false) => {
    setSaving(true);
    setFormErrors([]);
    setDuplicate(null);
    try {
      const body = {
        ...form,
        quantity: Number(form.quantity),
        price: Number(form.price),
        fee: Number(form.fee || 0),
        trade_datetime: new Date(form.trade_datetime).toISOString(),
        force,
      };
      if (editingId) await api.put(`/api/trades/${editingId}`, body);
      else await api.post('/api/trades', body);
      setModal(null);
      await load();
      await refresh();
    } catch (e) {
      if (e.status === 409 && e.data?.duplicate) {
        setDuplicate(e.data);
      } else {
        setFormErrors(e.data?.errors || [e.message]);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete the ${t.side} of ${t.pair} on ${shortDateTime(t.trade_datetime)}? This is recorded in the audit history.`)) return;
    await api.del(`/api/trades/${t.id}`);
    await load();
    await refresh();
  };

  const runImport = async () => {
    setSaving(true);
    setImportSummary(null);
    try {
      const data = await api.post('/api/trades/import', { csv: importText });
      setImportSummary(data.summary);
      await load();
      await refresh();
    } catch (e) {
      setImportSummary({ error: e.message });
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportText(await file.text());
  };

  const m = (v) => money(v, displayCurrency, fx);

  return (
    <div className="stack">
      <Card
        title="Transactions"
        desc={`${total} record(s) matching the current filters`}
        actions={
          <div className="row wrap">
            <button className="btn ghost sm" type="button" onClick={() => { setImportText(''); setImportSummary(null); setModal('import'); }}>
              Import CSV
            </button>
            <button className="btn primary sm" type="button" onClick={openCreate}>
              Add trade
            </button>
          </div>
        }
      >
        <div className="grid cols-3" style={{ marginBottom: 14 }}>
          <Field label="Search">
            <input className="input" placeholder="Pair, order ID, strategy or notes" value={filters.q} onChange={setFilter('q')} />
          </Field>
          <Field label="Pair">
            <select className="select" style={{ width: '100%' }} value={filters.pair} onChange={setFilter('pair')}>
              <option value="">All pairs</option>
              {meta.pairs.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Side">
            <select className="select" style={{ width: '100%' }} value={filters.side} onChange={setFilter('side')}>
              <option value="">Buy & sell</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </Field>
          <Field label="Strategy">
            <select className="select" style={{ width: '100%' }} value={filters.strategy} onChange={setFilter('strategy')}>
              <option value="">All strategies</option>
              {meta.strategies.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Fee currency">
            <select className="select" style={{ width: '100%' }} value={filters.fee_currency} onChange={setFilter('fee_currency')}>
              <option value="">All fee currencies</option>
              {meta.feeCurrencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="From / To">
            <div className="row">
              <input className="input" type="date" value={filters.from} onChange={setFilter('from')} />
              <input className="input" type="date" value={filters.to} onChange={setFilter('to')} />
            </div>
          </Field>
        </div>

        {error && <Banner tone="neg">{error}</Banner>}

        {loading ? (
          <Loading label="Loading transactions…" />
        ) : trades.length === 0 ? (
          <EmptyState
            title="No transactions found"
            desc="Adjust the filters, add a trade manually, or import a CSV exported from OKX. Duplicate imports are detected automatically."
            action={<button className="btn primary sm" type="button" onClick={openCreate}>Add your first trade</button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Pair</th>
                  <th>Side</th>
                  <th className="num">Quantity</th>
                  <th className="num">Price</th>
                  <th className="num">Fee</th>
                  <th>Order ID</th>
                  <th>Strategy</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap">{shortDateTime(t.trade_datetime)}</td>
                    <td>{t.pair}</td>
                    <td>
                      <Badge tone={t.side === 'buy' ? 'info' : 'teal'}>{t.side.toUpperCase()}</Badge>
                    </td>
                    <td className="num">{num(t.quantity, 6)}</td>
                    <td className="num">{num(t.price, 4)}</td>
                    <td className="num">{num(t.fee, 4)} <span className="muted">{t.fee_currency}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{t.order_id || '—'}</td>
                    <td>{t.strategy || <span className="muted">Unassigned</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn ghost sm" type="button" onClick={() => openEdit(t)}>Edit</button>
                        <button className="btn danger sm" type="button" onClick={() => remove(t)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          Each row is an individual trade fill. Fills sharing an order ID represent partial fills of the same order. Fees may be charged in
          a different currency than the pair quote.
        </p>
      </Card>

      <Card title="Audit history" desc="Every create, update, delete and import is recorded">
        {audit.length === 0 ? (
          <EmptyState title="No audit entries yet" desc="Changes to transactions will be listed here." />
        ) : (
          <div className="table-wrap scroll-y">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Trade</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{shortDateTime(a.at)}</td>
                    <td><Badge tone={a.action === 'delete' ? 'neg' : a.action === 'create' ? 'pos' : 'info'}>{a.action}</Badge></td>
                    <td>{a.pair ? `${a.pair} (${a.side}) #${a.trade_id}` : '—'}</td>
                    <td className="muted">{a.actor || 'system'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={editingId ? 'Edit trade' : 'Add trade'} onClose={() => setModal(null)}>
          <div className="form-grid">
            <Field label="Trade date &amp; time">
              <input className="input" type="datetime-local" value={form.trade_datetime} onChange={(e) => setForm((f) => ({ ...f, trade_datetime: e.target.value }))} />
            </Field>
            <Field label="Trading pair" hint="e.g. BTC/USDT">
              <input className="input" value={form.pair} onChange={(e) => setForm((f) => ({ ...f, pair: e.target.value }))} />
            </Field>
            <Field label="Side">
              <select className="select" style={{ width: '100%' }} value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </Field>
            <Field label="Executed quantity">
              <input className="input" type="number" step="any" min="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </Field>
            <Field label="Execution price">
              <input className="input" type="number" step="any" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </Field>
            <Field label="Trading fee">
              <input className="input" type="number" step="any" min="0" value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} />
            </Field>
            <Field label="Fee currency">
              <input className="input" value={form.fee_currency} onChange={(e) => setForm((f) => ({ ...f, fee_currency: e.target.value }))} />
            </Field>
            <Field label="Order ID" hint="Fills of the same order share an ID">
              <input className="input" value={form.order_id} onChange={(e) => setForm((f) => ({ ...f, order_id: e.target.value }))} />
            </Field>
            <Field label="Strategy name">
              <input className="input" list="strategy-options" value={form.strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))} />
              <datalist id="strategy-options">
                {meta.strategies.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Notes" full>
              <textarea className="textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>

          {formErrors.length > 0 && (
            <div className="banner neg" style={{ marginTop: 14 }}>
              <div>
                <strong>Please fix the following</strong>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {formErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {duplicate && (
            <div className="banner warn" style={{ marginTop: 14 }}>
              <div>
                <strong>Possible duplicate</strong>
                <div>{duplicate.message}</div>
                <button className="btn sm" style={{ marginTop: 8 }} type="button" onClick={() => submit(true)}>
                  Record anyway
                </button>
              </div>
            </div>
          )}

          <div className="row between" style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" type="button" disabled={saving} onClick={() => submit(false)}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add trade'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'import' && (
        <Modal title="Import trades from CSV" onClose={() => setModal(null)}>
          <Banner>
            Recognised columns: <span className="mono">trade_datetime, pair, side, quantity, price, fee, fee_currency, order_id, notes, strategy</span>.
            Common aliases (date, symbol, qty, size) are accepted. Duplicate rows are skipped automatically.
          </Banner>
          <div className="stack" style={{ marginTop: 14, gap: 12 }}>
            <Field label="CSV file">
              <input ref={fileRef} className="input" type="file" accept=".csv,text/csv" onChange={onFile} />
            </Field>
            <Field label="Or paste CSV content">
              <textarea className="textarea" style={{ minHeight: 150 }} value={importText} onChange={(e) => setImportText(e.target.value)} />
            </Field>
          </div>

          {importSummary && (
            <div className={`banner ${importSummary.error ? 'neg' : 'info'}`} style={{ marginTop: 14 }}>
              {importSummary.error ? (
                importSummary.error
              ) : (
                <div>
                  <strong>Import complete</strong>
                  <div>
                    Rows read {importSummary.total} · imported {importSummary.imported} · duplicates skipped {importSummary.duplicates} · invalid {importSummary.invalid}
                  </div>
                  {importSummary.errors?.length > 0 && (
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      {importSummary.errors.slice(0, 5).map((e) => (
                        <li key={e.row}>Row {e.row}: {e.errors.join(' ')}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="row between" style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={() => setModal(null)}>Close</button>
            <button className="btn primary" type="button" disabled={saving || !importText.trim()} onClick={runImport}>
              {saving ? 'Importing…' : 'Import trades'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
