import { Router } from 'express';
import { query, getSettings, setSetting } from '../db.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

router.put(
  '/',
  ah(async (req, res) => {
    const body = req.body || {};
    const errors = [];
    const updates = {};

    if (body.initial_capital !== undefined) {
      const v = Number(body.initial_capital);
      if (!Number.isFinite(v) || v < 0) errors.push('Initial capital must be zero or greater.');
      else updates.initial_capital = v;
    }
    if (body.base_currency !== undefined) {
      const v = String(body.base_currency).toUpperCase();
      if (!['PHP', 'USDT'].includes(v)) errors.push('Base currency must be PHP or USDT.');
      else updates.base_currency = v;
    }
    if (body.fx_rate !== undefined) {
      const rate = Number(body.fx_rate?.rate);
      if (!Number.isFinite(rate) || rate <= 0) errors.push('Exchange rate must be greater than zero.');
      else
        updates.fx_rate = {
          rate,
          updated_at: new Date().toISOString(),
          source: body.fx_rate?.source ? String(body.fx_rate.source) : 'manual',
        };
    }
    if (body.demo_mode !== undefined) updates.demo_mode = Boolean(body.demo_mode);
    if (body.strategy_notes !== undefined) updates.strategy_notes = body.strategy_notes;
    if (body.risk !== undefined) {
      const risk = {};
      for (const [k, v] of Object.entries(body.risk)) {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          errors.push(`Risk threshold "${k}" must be a non-negative number.`);
          continue;
        }
        risk[k] = n;
      }
      updates.risk = risk;
    }

    if (errors.length) return res.status(400).json({ error: 'invalid_input', errors });
    for (const [key, value] of Object.entries(updates)) await setSetting(key, value);
    res.json({ settings: await getSettings() });
  }),
);

router.get(
  '/prices',
  ah(async (req, res) => {
    const rows = (await query('SELECT * FROM market_prices ORDER BY symbol')).rows;
    res.json({ prices: rows.map((r) => ({ ...r, price_usdt: Number(r.price_usdt) })) });
  }),
);

router.post(
  '/prices',
  ah(async (req, res) => {
    const symbol = String(req.body?.symbol || '').trim().toUpperCase();
    const price = Number(req.body?.price_usdt);
    if (!symbol) return res.status(400).json({ error: 'invalid_input', message: 'Symbol is required.' });
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'invalid_input', message: 'Price must be greater than zero.' });
    await query(
      `INSERT INTO market_prices (symbol, price_usdt, source, is_demo, updated_at)
       VALUES ($1, $2, 'manual', false, now())
       ON CONFLICT (symbol) DO UPDATE SET price_usdt = EXCLUDED.price_usdt, source = 'manual', is_demo = false, updated_at = now()`,
      [symbol, price],
    );
    const rows = (await query('SELECT * FROM market_prices ORDER BY symbol')).rows;
    res.json({ prices: rows.map((r) => ({ ...r, price_usdt: Number(r.price_usdt) })) });
  }),
);

export default router;
