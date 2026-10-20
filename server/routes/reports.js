import { Router } from 'express';
import { loadModel } from '../lib/model.js';
import { buildReports } from '../lib/reports.js';
import { toCsv } from '../lib/csv.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const KINDS = ['daily', 'weekly', 'monthly'];

router.get(
  '/',
  ah(async (req, res) => {
    const kind = KINDS.includes(String(req.query.period)) ? String(req.query.period) : 'monthly';
    const model = await loadModel();
    const reports = buildReports(model, kind, req.query.from || null, req.query.to || null);
    res.json({ period: kind, reports, meta: model.meta, dataQuality: model.dataQuality });
  }),
);

router.get(
  '/export.csv',
  ah(async (req, res) => {
    const kind = KINDS.includes(String(req.query.period)) ? String(req.query.period) : 'monthly';
    const model = await loadModel();
    const reports = buildReports(model, kind, req.query.from || null, req.query.to || null);
    const rows = reports.map((r) => ({
      period: r.key,
      opening_value_php: r.openingValue,
      closing_value_php: r.closingValue,
      deposits_php: r.deposits,
      withdrawals_php: r.withdrawals,
      realized_pnl_php: r.realizedPnl,
      unrealized_pnl_php: r.unrealizedPnl,
      fees_php: r.fees,
      net_return_pct: r.netReturnPct,
      drawdown_pct: r.drawdownPct,
      top_strategy: r.strategies[0]?.key || '',
      risk_warnings: r.riskWarnings.map((w) => w.title).join(' | '),
      marco_analysis: r.marcoAnalysis.text,
    }));
    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="marco-ai-${kind}-reports.csv"`);
    res.send(csv);
  }),
);

export default router;
