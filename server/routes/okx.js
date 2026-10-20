import { Router } from 'express';
import { query } from '../db.js';
import { loadModel } from '../lib/model.js';
import { okxConfigured, fetchBalances, maskKey } from '../lib/okx.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function connection() {
  return (await query('SELECT * FROM okx_connection WHERE id = 1')).rows[0] || null;
}

router.get(
  '/status',
  ah(async (req, res) => {
    const conn = await connection();
    res.json({
      configured: okxConfigured(),
      status: conn?.status || 'disconnected',
      last_sync: conn?.last_sync || null,
      last_error: conn?.last_error || null,
      read_only: true,
      api_key_masked: conn?.api_key_masked || null,
      reconciliation: conn?.reconciliation || 'not_run',
      balances: conn?.balances || [],
      permissions_note: 'Only read-only account permissions are used. Withdrawal permissions are never requested.',
    });
  }),
);

router.post(
  '/sync',
  ah(async (req, res) => {
    if (!okxConfigured()) {
      await query(
        `UPDATE okx_connection SET status = 'disconnected', last_error = $1, updated_at = now() WHERE id = 1`,
        ['OKX API credentials are not configured on the server.'],
      );
      return res.status(400).json({
        error: 'not_configured',
        message:
          'OKX API credentials are not configured on the server. Add read-only OKX_API_KEY, OKX_API_SECRET and OKX_API_PASSPHRASE to enable synchronization.',
      });
    }
    try {
      const balances = await fetchBalances();
      const model = await loadModel();

      // Reconcile exchange balances against locally recorded holdings and cash.
      const localQty = {};
      for (const p of model.positions) localQty[p.symbol] = p.quantity;
      const localUsdtCash = model.kpis.availableCash / model.meta.fxRate;
      const exchange = {};
      for (const b of balances) exchange[b.currency] = b.equity;

      const diffs = [];
      const tol = 0.0001;
      for (const [ccy, qty] of Object.entries(localQty)) {
        const ex = exchange[ccy] || 0;
        if (Math.abs(ex - qty) > Math.max(tol, qty * 0.01)) diffs.push({ currency: ccy, local: qty, exchange: ex });
      }
      const exUsdt = exchange.USDT || 0;
      if (Math.abs(exUsdt - localUsdtCash) > Math.max(1, localUsdtCash * 0.02)) {
        diffs.push({ currency: 'USDT', local: Number(localUsdtCash.toFixed(4)), exchange: exUsdt });
      }
      const reconciliation = diffs.length ? 'mismatch' : 'match';

      await query(
        `UPDATE okx_connection SET status='connected', last_sync=now(), last_error=NULL, api_key_masked=$1,
          balances=$2, reconciliation=$3, updated_at=now() WHERE id=1`,
        [maskKey(process.env.OKX_API_KEY), JSON.stringify(balances), reconciliation],
      );
      res.json({ ok: true, balances, reconciliation, differences: diffs });
    } catch (err) {
      await query(`UPDATE okx_connection SET status='error', last_error=$1, updated_at=now() WHERE id=1`, [err.message]);
      res.status(502).json({ error: 'okx_error', message: err.message });
    }
  }),
);

router.post(
  '/disconnect',
  ah(async (req, res) => {
    await query(
      `UPDATE okx_connection SET status='disconnected', last_error=NULL, reconciliation='not_run', balances=NULL, updated_at=now() WHERE id=1`,
    );
    res.json({ ok: true });
  }),
);

export default router;
