import { Router } from 'express';
import { query, dedupeHash, getSettings } from '../db.js';
import { csvToObjects } from '../lib/csv.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const num = (v) => (v == null ? null : Number(v));
const serialize = (r) => ({ ...r, quantity: num(r.quantity), price: num(r.price), fee: num(r.fee) });

function validateTrade(body) {
  const t = {
    trade_datetime: body.trade_datetime ? new Date(body.trade_datetime).toISOString() : null,
    pair: String(body.pair || '').trim().toUpperCase(),
    side: String(body.side || '').trim().toLowerCase(),
    quantity: Number(body.quantity),
    price: Number(body.price),
    fee: Number(body.fee || 0),
    fee_currency: String(body.fee_currency || 'USDT').trim().toUpperCase(),
    order_id: body.order_id ? String(body.order_id).trim() : null,
    notes: body.notes ? String(body.notes) : null,
    strategy: body.strategy ? String(body.strategy).trim() : null,
    source: body.source ? String(body.source) : 'manual',
  };
  const errors = [];
  if (!t.trade_datetime || Number.isNaN(new Date(t.trade_datetime).getTime())) errors.push('A valid trade date/time is required.');
  if (!/^[A-Z0-9]{1,12}\/[A-Z0-9]{2,12}$/.test(t.pair)) errors.push('Trading pair must look like BTC/USDT.');
  if (!['buy', 'sell'].includes(t.side)) errors.push('Side must be "buy" or "sell".');
  if (!Number.isFinite(t.quantity) || t.quantity <= 0) errors.push('Quantity must be greater than zero.');
  if (!Number.isFinite(t.price) || t.price <= 0) errors.push('Execution price must be greater than zero.');
  if (!Number.isFinite(t.fee) || t.fee < 0) errors.push('Trading fee cannot be negative.');
  return { t, errors };
}

async function audit(tradeId, action, details, actor) {
  await query('INSERT INTO trade_audit (trade_id, action, details, actor) VALUES ($1, $2, $3, $4)', [
    tradeId,
    action,
    JSON.stringify(details),
    actor || 'owner',
  ]);
}

// --- Meta (declared before /:id) ---
router.get(
  '/meta',
  ah(async (req, res) => {
    const pairs = (await query('SELECT DISTINCT pair FROM trades ORDER BY pair')).rows.map((r) => r.pair);
    const strategies = (await query('SELECT DISTINCT strategy FROM trades WHERE strategy IS NOT NULL ORDER BY strategy')).rows.map((r) => r.strategy);
    const feeCurrencies = (await query('SELECT DISTINCT fee_currency FROM trades ORDER BY fee_currency')).rows.map((r) => r.fee_currency);
    res.json({ pairs, strategies, feeCurrencies });
  }),
);

// --- Audit history (declared before /:id) ---
router.get(
  '/audit',
  ah(async (req, res) => {
    const rows = (
      await query(
        `SELECT a.id, a.trade_id, a.action, a.details, a.actor, a.at, t.pair, t.side
         FROM trade_audit a LEFT JOIN trades t ON t.id = a.trade_id
         ORDER BY a.at DESC, a.id DESC LIMIT 300`,
      )
    ).rows;
    res.json({ entries: rows });
  }),
);

// --- CSV import ---
router.post(
  '/import',
  ah(async (req, res) => {
    const csv = req.body?.csv;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'invalid_input', message: 'CSV content is required.' });
    }
    const rows = csvToObjects(csv);
    const summary = { total: rows.length, imported: 0, duplicates: 0, invalid: 0, errors: [] };
    const pick = (r, keys) => {
      for (const k of keys) if (r[k] !== undefined && r[k] !== '') return r[k];
      return undefined;
    };
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const mapped = {
        trade_datetime: pick(r, ['trade_datetime', 'datetime', 'date', 'time', 'timestamp']),
        pair: pick(r, ['pair', 'symbol', 'instrument', 'market']),
        side: pick(r, ['side', 'type', 'direction']),
        quantity: pick(r, ['quantity', 'qty', 'size', 'amount']),
        price: pick(r, ['price', 'execution_price', 'avg_price', 'fill_price']),
        fee: pick(r, ['fee', 'fees', 'trading_fee']) || 0,
        fee_currency: pick(r, ['fee_currency', 'feeccy', 'fee_ccy']) || 'USDT',
        order_id: pick(r, ['order_id', 'orderid', 'order', 'id']),
        notes: pick(r, ['notes', 'note', 'comment']),
        strategy: pick(r, ['strategy', 'strategy_name']),
      };
      const { t, errors } = validateTrade({ ...mapped, source: 'csv' });
      if (errors.length) {
        summary.invalid += 1;
        if (summary.errors.length < 25) summary.errors.push({ row: i + 2, errors });
        continue;
      }
      const hash = dedupeHash(t);
      const existing = await query('SELECT id FROM trades WHERE dedupe_hash = $1', [hash]);
      if (existing.rows[0]) {
        summary.duplicates += 1;
        continue;
      }
      const { rows: inserted } = await query(
        `INSERT INTO trades (trade_datetime,pair,side,quantity,price,fee,fee_currency,order_id,notes,strategy,source,is_demo,dedupe_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'csv',$11,$12) RETURNING *`,
        [t.trade_datetime, t.pair, t.side, t.quantity, t.price, t.fee, t.fee_currency, t.order_id, t.notes, t.strategy, Boolean(req.body.is_demo), hash],
      );
      await audit(inserted[0].id, 'import', { after: serialize(inserted[0]) }, req.user?.email);
      summary.imported += 1;
    }
    res.json({ summary });
  }),
);

// --- List with filters ---
router.get(
  '/',
  ah(async (req, res) => {
    const settings = await getSettings();
    const includeDemo = settings.demo_mode !== false;
    const clauses = [];
    const params = [];
    const add = (sql, value) => {
      params.push(value);
      clauses.push(sql.replace('$?', `$${params.length}`));
    };
    if (!includeDemo) clauses.push('is_demo = false');
    if (req.query.from) add('trade_datetime >= $?', req.query.from);
    if (req.query.to) add('trade_datetime <= $?', req.query.to);
    if (req.query.pair) add('upper(pair) = $?', String(req.query.pair).toUpperCase());
    if (req.query.side) add('side = $?', String(req.query.side).toLowerCase());
    if (req.query.strategy) add('strategy = $?', req.query.strategy);
    if (req.query.fee_currency) add('upper(fee_currency) = $?', String(req.query.fee_currency).toUpperCase());
    if (req.query.source) add('source = $?', req.query.source);
    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      const i = params.length;
      clauses.push(
        `(lower(pair) LIKE $${i} OR lower(coalesce(order_id,'')) LIKE $${i} OR lower(coalesce(notes,'')) LIKE $${i} OR lower(coalesce(strategy,'')) LIKE $${i})`,
      );
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = (await query(`SELECT count(*)::int AS c FROM trades ${where}`, params)).rows[0].c;
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 1000);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const rows = (
      await query(`SELECT * FROM trades ${where} ORDER BY trade_datetime DESC, id DESC LIMIT ${limit} OFFSET ${offset}`, params)
    ).rows;
    res.json({ total, limit, offset, trades: rows.map(serialize) });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const { rows } = await query('SELECT * FROM trades WHERE id = $1', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const history = (await query('SELECT * FROM trade_audit WHERE trade_id = $1 ORDER BY at DESC', [Number(req.params.id)])).rows;
    res.json({ trade: serialize(rows[0]), history });
  }),
);

router.post(
  '/',
  ah(async (req, res) => {
    const { t, errors } = validateTrade(req.body || {});
    if (errors.length) return res.status(400).json({ error: 'invalid_input', errors });
    const hash = dedupeHash(t);
    const existing = await query('SELECT id FROM trades WHERE dedupe_hash = $1', [hash]);
    if (existing.rows[0] && !req.body.force) {
      return res.status(409).json({
        error: 'duplicate',
        duplicate: true,
        existing_id: existing.rows[0].id,
        message: 'An identical trade already exists (same order, time, pair, side, quantity and price). Confirm to record it anyway.',
      });
    }
    const finalHash = existing.rows[0] ? `${hash}|${Date.now()}` : hash;
    const { rows } = await query(
      `INSERT INTO trades (trade_datetime,pair,side,quantity,price,fee,fee_currency,order_id,notes,strategy,source,is_demo,dedupe_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [t.trade_datetime, t.pair, t.side, t.quantity, t.price, t.fee, t.fee_currency, t.order_id, t.notes, t.strategy, t.source, Boolean(req.body.is_demo), finalHash],
    );
    await audit(rows[0].id, 'create', { after: serialize(rows[0]) }, req.user?.email);
    res.status(201).json({ trade: serialize(rows[0]) });
  }),
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const before = (await query('SELECT * FROM trades WHERE id = $1', [id])).rows[0];
    if (!before) return res.status(404).json({ error: 'not_found' });
    const { t, errors } = validateTrade({ ...serialize(before), ...req.body });
    if (errors.length) return res.status(400).json({ error: 'invalid_input', errors });
    const hash = dedupeHash(t);
    const clash = await query('SELECT id FROM trades WHERE dedupe_hash = $1 AND id <> $2', [hash, id]);
    if (clash.rows[0]) {
      return res.status(409).json({ error: 'duplicate', duplicate: true, existing_id: clash.rows[0].id, message: 'Another trade with these exact details already exists.' });
    }
    const { rows } = await query(
      `UPDATE trades SET trade_datetime=$1, pair=$2, side=$3, quantity=$4, price=$5, fee=$6, fee_currency=$7,
        order_id=$8, notes=$9, strategy=$10, source=$11, dedupe_hash=$12, updated_at=now()
       WHERE id=$13 RETURNING *`,
      [t.trade_datetime, t.pair, t.side, t.quantity, t.price, t.fee, t.fee_currency, t.order_id, t.notes, t.strategy, t.source, hash, id],
    );
    await audit(id, 'update', { before: serialize(before), after: serialize(rows[0]) }, req.user?.email);
    res.json({ trade: serialize(rows[0]) });
  }),
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const before = (await query('SELECT * FROM trades WHERE id = $1', [id])).rows[0];
    if (!before) return res.status(404).json({ error: 'not_found' });
    await query('DELETE FROM trades WHERE id = $1', [id]);
    await audit(id, 'delete', { before: serialize(before) }, req.user?.email);
    res.json({ ok: true });
  }),
);

export default router;
