import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'db',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'marco',
  password: process.env.PGPASSWORD || 'marco_dev_pw',
  database: process.env.PGDATABASE || 'marco',
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  trade_datetime TIMESTAMPTZ NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity NUMERIC(28,10) NOT NULL,
  price NUMERIC(28,10) NOT NULL,
  fee NUMERIC(28,10) NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'USDT',
  order_id TEXT,
  notes TEXT,
  strategy TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  dedupe_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trade_audit (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER,
  action TEXT NOT NULL,
  details JSONB,
  actor TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_flows (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  amount NUMERIC(28,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS market_prices (
  symbol TEXT PRIMARY KEY,
  price_usdt NUMERIC(28,10) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okx_connection (
  id INTEGER PRIMARY KEY,
  api_key_masked TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_sync TIMESTAMPTZ,
  last_error TEXT,
  read_only BOOLEAN NOT NULL DEFAULT true,
  reconciliation TEXT,
  balances JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export const DEFAULT_SETTINGS = {
  base_currency: 'PHP',
  initial_capital: 100000,
  fx_rate: { rate: 58.5, updated_at: '2026-10-20T08:00:00.000Z', source: 'manual' },
  demo_mode: true,
  risk: {
    max_position_pct: 40,
    large_position_pct: 30,
    max_daily_loss_pct: 3,
    max_monthly_loss_pct: 8,
    max_drawdown_pct: 15,
    min_cash_pct: 10,
    stale_price_hours: 24,
  },
  strategy_notes: {},
  okx: { base_url: 'https://www.okx.com', read_only: true },
};

// All sample records are flagged is_demo = true and are never presented as real results.
const DEMO_TRADES = [
  ['2026-07-05T09:15:00Z', 'BTC/USDT', 'buy', 0.004, 61000, 0.7, 'USDT', 'OKX-DEMO-1001', 'Breakout', 'Initial breakout entry'],
  ['2026-07-18T14:40:00Z', 'BTC/USDT', 'sell', 0.002, 66500, 0.4, 'USDT', 'OKX-DEMO-1002', 'Breakout', 'Partial take-profit'],
  ['2026-07-27T10:05:00Z', 'ETH/USDT', 'buy', 0.07, 3200, 0.7, 'USDT', 'OKX-DEMO-1003', 'DCA Accumulation', 'Fill 1 of 2'],
  ['2026-07-27T10:06:00Z', 'ETH/USDT', 'buy', 0.05, 3198, 0.5, 'USDT', 'OKX-DEMO-1003', 'DCA Accumulation', 'Fill 2 of 2 (partial fill)'],
  ['2026-08-06T11:20:00Z', 'SOL/USDT', 'buy', 2, 145, 0.9, 'USDT', 'OKX-DEMO-1004', 'Breakout', 'Momentum entry'],
  ['2026-08-14T15:55:00Z', 'ETH/USDT', 'sell', 0.06, 3450, 0.7, 'USDT', 'OKX-DEMO-1005', 'DCA Accumulation', 'Trim into strength'],
  ['2026-08-21T08:30:00Z', 'SOL/USDT', 'sell', 0.8, 128, 0.3, 'USDT', 'OKX-DEMO-1006', 'Breakout', 'Stop-out (loss)'],
  ['2026-08-29T16:10:00Z', 'BTC/USDT', 'buy', 0.002, 58500, 0.4, 'USDT', 'OKX-DEMO-1007', 'Mean Reversion', 'Dip buy'],
  ['2026-09-04T12:45:00Z', 'XRP/USDT', 'buy', 300, 0.52, 0.5, 'USDT', 'OKX-DEMO-1008', 'Swing', 'Range entry'],
  ['2026-09-11T09:50:00Z', 'ETH/USDT', 'buy', 0.08, 3050, 0.8, 'USDT', 'OKX-DEMO-1009', 'DCA Accumulation', 'Add on dip'],
  ['2026-09-19T13:25:00Z', 'SOL/USDT', 'buy', 1.5, 158, 0.7, 'USDT', 'OKX-DEMO-1010', 'Mean Reversion', 'Re-entry'],
  ['2026-09-25T10:40:00Z', 'XRP/USDT', 'sell', 150, 0.61, 0.3, 'USDT', 'OKX-DEMO-1011', 'Swing', 'Partial exit'],
  ['2026-10-02T14:15:00Z', 'BTC/USDT', 'sell', 0.0025, 64000, 0.5, 'USDT', 'OKX-DEMO-1012', 'Breakout', 'Trend exit'],
  ['2026-10-08T11:05:00Z', 'ETH/USDT', 'sell', 0.05, 3320, 0.6, 'USDT', 'OKX-DEMO-1013', 'DCA Accumulation', 'Profit take'],
  ['2026-10-13T15:35:00Z', 'SOL/USDT', 'sell', 1.2, 172, 0.6, 'USDT', 'OKX-DEMO-1014', 'Mean Reversion', 'Target hit'],
  ['2026-10-16T09:20:00Z', 'XRP/USDT', 'buy', 200, 0.55, 0.4, 'USDT', 'OKX-DEMO-1015', 'Swing', 'Add to position'],
  ['2026-10-18T13:50:00Z', 'BTC/USDT', 'buy', 0.0015, 67000, 0.3, 'USDT', 'OKX-DEMO-1016', 'Breakout', 'Continuation buy'],
];

const DEMO_PRICES = [
  ['BTC', 68200, '2026-10-20T08:00:00Z'],
  ['ETH', 3380, '2026-10-20T08:00:00Z'],
  ['SOL', 178, '2026-10-20T08:00:00Z'],
  ['XRP', 0.58, '2026-10-20T08:00:00Z'],
];

export function dedupeHash(t) {
  const parts = [
    String(t.order_id || '').trim().toUpperCase(),
    new Date(t.trade_datetime).toISOString(),
    String(t.pair || '').trim().toUpperCase(),
    String(t.side || '').trim().toLowerCase(),
    Number(t.quantity).toFixed(10),
    Number(t.price).toFixed(10),
  ];
  return parts.join('|');
}

export async function ensureSchema() {
  await pool.query(SCHEMA);

  const users = await pool.query('SELECT count(*)::int AS c FROM users');
  if (users.rows[0].c === 0) {
    const hash = bcrypt.hashSync('marco-demo-2026', 10);
    await pool.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['demo@marco.ai', 'Marco Demo Owner', hash, 'owner'],
    );
  }

  const settingsCount = await pool.query('SELECT count(*)::int AS c FROM settings');
  if (settingsCount.rows[0].c === 0) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, JSON.stringify(value)]);
    }
  }

  const trades = await pool.query('SELECT count(*)::int AS c FROM trades');
  if (trades.rows[0].c === 0) {
    for (const row of DEMO_TRADES) {
      const [dt, pair, side, qty, price, fee, feeCur, orderId, strategy, notes] = row;
      const hash = dedupeHash({ trade_datetime: dt, pair, side, quantity: qty, price, order_id: orderId });
      await pool.query(
        `INSERT INTO trades
          (trade_datetime, pair, side, quantity, price, fee, fee_currency, order_id, notes, strategy, source, is_demo, dedupe_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'demo',true,$11)`,
        [dt, pair, side, qty, price, fee, feeCur, orderId, notes, strategy, hash],
      );
    }
    await pool.query(
      `INSERT INTO cash_flows (type, amount, currency, occurred_at, notes, is_demo)
       VALUES ('deposit', 20000, 'PHP', '2026-08-01T09:00:00Z', 'DEMO DATA — sample capital top-up', true)`,
    );
    await pool.query(
      `INSERT INTO trade_audit (trade_id, action, details, actor)
       VALUES (NULL, 'seed', $1, 'system')`,
      [JSON.stringify({ note: 'Demo dataset seeded', count: DEMO_TRADES.length })],
    );
  }

  const prices = await pool.query('SELECT count(*)::int AS c FROM market_prices');
  if (prices.rows[0].c === 0) {
    for (const [symbol, price, updatedAt] of DEMO_PRICES) {
      await pool.query(
        `INSERT INTO market_prices (symbol, price_usdt, source, is_demo, updated_at)
         VALUES ($1,$2,'demo',true,$3)`,
        [symbol, price, updatedAt],
      );
    }
  }

  const okx = await pool.query('SELECT count(*)::int AS c FROM okx_connection');
  if (okx.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO okx_connection (id, status, read_only, reconciliation)
       VALUES (1, 'disconnected', true, 'not_run')`,
    );
  }
}

export async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
