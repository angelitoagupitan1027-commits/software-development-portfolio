import { periodKey } from './analytics.js';
import { aiStatus } from './ai.js';

const r2 = (n) => (n == null || Number.isNaN(n) ? null : Math.round((n + Number.EPSILON) * 100) / 100);

function labelFor(key, kind) {
  if (kind === 'monthly') return key;
  if (kind === 'weekly') return `Week ${key}`;
  return key;
}

// Deterministic, factual narrative. AI narration is only added when a provider is configured.
function narrative(report, meta) {
  const parts = [];
  parts.push(
    `${report.label}: portfolio value moved from ${fmt(report.openingValue)} to ${fmt(report.closingValue)} (${report.netReturnPct == null ? 'n/a' : `${report.netReturnPct}%`}).`,
  );
  parts.push(`Realized P&L ${fmt(report.realizedPnl)}; trading fees ${fmt(report.fees)}.`);
  if (report.deposits || report.withdrawals) {
    parts.push(`Capital flows in the period: deposits ${fmt(report.deposits)}, withdrawals ${fmt(report.withdrawals)} — these are not counted as trading profit.`);
  }
  if (report.strategies.length) {
    const best = report.strategies[0];
    const worst = report.strategies[report.strategies.length - 1];
    parts.push(`Best strategy: ${best.key} (${fmt(best.realized)}). Weakest: ${worst.key} (${fmt(worst.realized)}).`);
  }
  if (report.riskWarnings.length) {
    parts.push(`Risk warnings: ${report.riskWarnings.map((w) => w.title).join('; ')}.`);
  } else {
    parts.push('No configured risk thresholds were breached.');
  }
  if (meta.insufficient) parts.push('Insufficient data: too few completed trades for statistically meaningful conclusions.');
  return parts.join(' ');
}

const fmt = (n) => (n == null ? 'n/a' : `PHP ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export function buildReports(model, kind, from, to) {
  const groups = new Map();
  const inRange = (d) => (!from || new Date(d) >= new Date(from)) && (!to || new Date(d) <= new Date(`${to}T23:59:59Z`));

  for (const p of model.equity) {
    const k = periodKey(p.date, kind);
    if (!groups.has(k)) {
      groups.set(k, {
        key: k,
        label: labelFor(k, kind),
        startDate: p.date,
        endDate: p.date,
        openingValue: p.equity,
        closingValue: p.equity,
        deposits: 0,
        withdrawals: 0,
        realizedPnl: 0,
        fees: 0,
        strategies: [],
      });
    }
    const g = groups.get(k);
    g.closingValue = p.equity;
    g.endDate = p.date;
  }

  for (const c of model.cashFlows || []) {
    const k = periodKey(c.occurred_at, kind);
    const g = groups.get(k);
    if (!g) continue;
    const amount = Number(c.amount);
    if (c.type === 'deposit') g.deposits += amount;
    else g.withdrawals += amount;
  }

  const realizedMap = new Map(model.periods[kind].map((p) => [p.key, p.value]));
  const feesMap = new Map(model.periods[`fees${kind[0].toUpperCase()}${kind.slice(1)}`].map((p) => [p.key, p.value]));
  for (const g of groups.values()) {
    g.realizedPnl = realizedMap.get(g.key) || 0;
    g.fees = feesMap.get(g.key) || 0;
  }

  const strategyByPeriod = new Map();
  for (const t of model.closedTrades) {
    const k = periodKey(t.trade_datetime, kind);
    if (!strategyByPeriod.has(k)) strategyByPeriod.set(k, new Map());
    const m = strategyByPeriod.get(k);
    const key = t.strategy || 'Unassigned';
    const s = m.get(key) || { key, realized: 0, trades: 0, wins: 0, losses: 0 };
    s.realized += t.pnl;
    s.trades += 1;
    if (t.pnl > 0) s.wins += 1;
    else if (t.pnl < 0) s.losses += 1;
    m.set(key, s);
  }

  const reports = [];
  for (const g of [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1))) {
    if (!inRange(g.startDate)) continue;
    const stratMap = strategyByPeriod.get(g.key);
    g.strategies = stratMap
      ? [...stratMap.values()]
          .map((s) => ({ ...s, realized: r2(s.realized), winRate: s.trades ? r2((s.wins / s.trades) * 100) : null }))
          .sort((a, b) => b.realized - a.realized)
      : [];
    g.openingValue = r2(g.openingValue);
    g.closingValue = r2(g.closingValue);
    g.deposits = r2(g.deposits);
    g.withdrawals = r2(g.withdrawals);
    g.realizedPnl = r2(g.realizedPnl);
    g.fees = r2(g.fees);
    g.unrealizedPnl = model.kpis.unrealizedPnl;
    g.netReturnPct = g.openingValue ? r2(((g.closingValue - g.openingValue) / g.openingValue) * 100) : null;
    g.drawdownPct = model.risk.drawdownPct;
    g.riskWarnings = model.risk.warnings;
    const status = aiStatus();
    g.marcoAnalysis = {
      configured: status.configured,
      text: narrative(g, model.dataQuality),
      notice: status.configured
        ? 'Deterministic summary generated from verified metrics.'
        : 'Deterministic summary from verified metrics. Add an OPENAI_API_KEY to enable conversational AI analysis.',
    };
    reports.push(g);
  }
  return reports;
}
