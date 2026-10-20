import { query, getSettings } from '../db.js';
import { buildModel } from './analytics.js';

// Loads the full business model from stored records, honouring demo-mode.
export async function loadModel() {
  const settings = await getSettings();
  const demo = settings.demo_mode !== false;

  const trades = (await query(`SELECT * FROM trades ${demo ? '' : 'WHERE is_demo = false'} ORDER BY trade_datetime ASC, id ASC`)).rows;
  const prices = (await query(`SELECT * FROM market_prices ${demo ? '' : 'WHERE is_demo = false'}`)).rows;
  const cashFlows = (await query(`SELECT * FROM cash_flows ${demo ? '' : 'WHERE is_demo = false'} ORDER BY occurred_at ASC`)).rows;
  const okx = (await query('SELECT * FROM okx_connection WHERE id = 1')).rows[0] || null;

  const model = buildModel({ trades, prices, cashFlows, settings, okx });
  model.okx = okx;
  model.settings = settings;
  model.cashFlows = cashFlows.map((c) => ({ ...c, amount: Number(c.amount) }));
  return model;
}
