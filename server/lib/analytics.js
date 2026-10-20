// Deterministic accounting + business intelligence.
// All figures are derived from stored records only — never from the AI model.

const r2 = (n) => (n == null || Number.isNaN(n) ? null : Math.round((n + Number.EPSILON) * 100) / 100);
const r4 = (n) => (n == null || Number.isNaN(n) ? null : Math.round((n + Number.EPSILON) * 10000) / 10000);

export const baseOf = (pair) => String(pair || '').split('/')[0].trim().toUpperCase();
export const quoteOf = (pair) => String(pair || '').split('/')[1]?.trim().toUpperCase() || 'USDT';

export function tradeEconomics(trade, fx) {
  const qty = Number(trade.quantity);
  const price = Number(trade.price);
  const fee = Number(trade.fee || 0);
  const valueUsdt = qty * price;
  const valuePhp = valueUsdt * fx;
  const cur = String(trade.fee_currency || 'USDT').toUpperCase();
  let feePhp;
  if (cur === 'PHP') feePhp = fee;
  else if (cur === 'USDT') feePhp = fee * fx;
  else feePhp = fee * price * fx; // fee paid in the base asset
  return { qty, price, fee, valueUsdt, valuePhp, feePhp, feeCurrency: cur };
}

export function periodKey(dateStr, kind) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (kind === 'monthly') return `${y}-${m}`;
  if (kind === 'daily') return `${y}-${m}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function computeDrawdown(points) {
  let peak = -Infinity;
  let peakIdx = -1;
  let curPeakIdx = -1;
  let maxDd = 0;
  let ddPeakIdx = -1;
  let ddTroughIdx = -1;
  points.forEach((p, i) => {
    if (p.equity > peak) {
      peak = p.equity;
      curPeakIdx = i;
    }
    if (peak > 0) {
      const dd = (peak - p.equity) / peak;
      if (dd > maxDd) {
        maxDd = dd;
        ddPeakIdx = curPeakIdx;
        ddTroughIdx = i;
      }
    }
  });
  return {
    pct: r2(maxDd * 100),
    peakDate: ddPeakIdx >= 0 ? points[ddPeakIdx].date : null,
    troughDate: ddTroughIdx >= 0 ? points[ddTroughIdx].date : null,
  };
}

function toSeries(map) {
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, value]) => ({ key, value: r2(value) }));
}

export function buildModel({ trades, prices, cashFlows, settings, okx, now }) {
  const fx = Number(settings?.fx_rate?.rate ?? 58.5);
  const initialCapital = Number(settings?.initial_capital ?? 100000);
  const nowIso = now || new Date().toISOString();
  const priceMap = {};
  for (const p of prices) priceMap[p.symbol] = p;

  const events = [];
  for (const t of trades) events.push({ kind: 'trade', at: t.trade_datetime, t });
  for (const c of cashFlows) events.push({ kind: 'cash', at: c.occurred_at, c });
  events.sort((a, b) => new Date(a.at) - new Date(b.at));

  let cash = initialCapital;
  let deposits = 0;
  let withdrawals = 0;
  const holdings = new Map();
  const closed = [];
  let totalFeesPhp = 0;
  const equitySeries = [];
  const feeSeries = [];
  const realizedByPeriod = { daily: new Map(), weekly: new Map(), monthly: new Map() };
  const feesByPeriod = { daily: new Map(), weekly: new Map(), monthly: new Map() };
  const byCoin = new Map();
  const byStrategy = new Map();

  equitySeries.push({
    date: events.length ? events[0].at : nowIso,
    equity: r2(initialCapital),
    cash: r2(cash),
    realized: 0,
  });

  for (const ev of events) {
    if (ev.kind === 'cash') {
      const amountPhp = Number(ev.c.amount) * (String(ev.c.currency).toUpperCase() === 'USDT' ? fx : 1);
      if (ev.c.type === 'deposit') {
        deposits += amountPhp;
        cash += amountPhp;
      } else {
        withdrawals += amountPhp;
        cash -= amountPhp;
      }
    } else {
      const t = ev.t;
      const e = tradeEconomics(t, fx);
      const base = baseOf(t.pair);
      const h = holdings.get(base) || { qty: 0, cost: 0 };
      totalFeesPhp += e.feePhp;

      if (t.side === 'buy') {
        cash -= e.valuePhp + e.feePhp;
        h.qty += e.qty;
        h.cost += e.valuePhp + e.feePhp;
      } else {
        cash += e.valuePhp - e.feePhp;
        const avg = h.qty > 0 ? h.cost / h.qty : 0;
        const sellQty = Math.min(e.qty, h.qty);
        const costOut = avg * sellQty;
        const proceeds = e.valuePhp - e.feePhp;
        const pnl = proceeds - costOut;
        h.qty -= e.qty;
        h.cost -= costOut;
        if (h.qty <= 1e-12) {
          h.qty = 0;
          h.cost = 0;
        }
        const rec = {
          ...t,
          base,
          qty: e.qty,
          price: e.price,
          pnl,
          proceeds,
          costOut,
          valuePhp: e.valuePhp,
          feePhp: e.feePhp,
        };
        closed.push(rec);

        for (const kind of ['daily', 'weekly', 'monthly']) {
          const k = periodKey(t.trade_datetime, kind);
          realizedByPeriod[kind].set(k, (realizedByPeriod[kind].get(k) || 0) + pnl);
        }
        const c = byCoin.get(base) || { key: base, realized: 0, trades: 0, wins: 0, losses: 0, feesPhp: 0, volumePhp: 0 };
        c.realized += pnl;
        c.trades += 1;
        c.feesPhp += e.feePhp;
        c.volumePhp += e.valuePhp;
        if (pnl > 0) c.wins += 1;
        else if (pnl < 0) c.losses += 1;
        byCoin.set(base, c);

        const sName = t.strategy || 'Unassigned';
        const st = byStrategy.get(sName) || { key: sName, realized: 0, trades: 0, wins: 0, losses: 0, feesPhp: 0, volumePhp: 0 };
        st.realized += pnl;
        st.trades += 1;
        st.feesPhp += e.feePhp;
        st.volumePhp += e.valuePhp;
        if (pnl > 0) st.wins += 1;
        else if (pnl < 0) st.losses += 1;
        byStrategy.set(sName, st);
      }

      for (const kind of ['daily', 'weekly', 'monthly']) {
        const k = periodKey(t.trade_datetime, kind);
        feesByPeriod[kind].set(k, (feesByPeriod[kind].get(k) || 0) + e.feePhp);
      }
      holdings.set(base, h);
    }

    let book = 0;
    for (const hh of holdings.values()) book += hh.cost;
    equitySeries.push({
      date: ev.at,
      equity: r2(cash + book),
      cash: r2(cash),
      realized: r2(closed.reduce((a, c) => a + c.pnl, 0)),
    });
    feeSeries.push({ date: ev.at, fees: r2(totalFeesPhp) });
  }

  const positions = [];
  let holdingsCostPhp = 0;
  let holdingsValuePhp = 0;
  let unpricedHoldings = 0;
  for (const [base, h] of holdings.entries()) {
    if (h.qty <= 1e-12 && Math.abs(h.cost) < 0.01) continue;
    const p = priceMap[base];
    const marketPriceUsdt = p ? Number(p.price_usdt) : null;
    const marketValuePhp = marketPriceUsdt != null ? h.qty * marketPriceUsdt * fx : null;
    if (marketValuePhp != null) holdingsValuePhp += marketValuePhp;
    else if (h.qty > 0) unpricedHoldings += 1;
    holdingsCostPhp += h.cost;
    positions.push({
      symbol: base,
      quantity: r4(h.qty),
      avgCostPhp: h.qty > 0 ? r2(h.cost / h.qty) : 0,
      avgCostUsdt: h.qty > 0 ? r4(h.cost / h.qty / fx) : 0,
      marketPriceUsdt,
      marketValuePhp: marketValuePhp != null ? r2(marketValuePhp) : null,
      costPhp: r2(h.cost),
      unrealizedPhp: marketValuePhp != null ? r2(marketValuePhp - h.cost) : null,
      unrealizedPct: marketValuePhp != null && h.cost > 0 ? r2(((marketValuePhp - h.cost) / h.cost) * 100) : null,
      priceUpdatedAt: p ? p.updated_at : null,
      priceIsDemo: p ? Boolean(p.is_demo) : false,
      priceSource: p ? p.source : null,
    });
  }
  positions.sort((a, b) => (b.marketValuePhp || 0) - (a.marketValuePhp || 0));

  const realizedPhp = closed.reduce((a, c) => a + c.pnl, 0);
  const unrealizedPhp = positions.reduce((a, p) => a + (p.unrealizedPhp || 0), 0);
  const portfolioValuePhp = cash + holdingsValuePhp;

  const wins = closed.filter((c) => c.pnl > 0);
  const losses = closed.filter((c) => c.pnl < 0);
  const grossProfit = wins.reduce((a, c) => a + c.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, c) => a + c.pnl, 0));
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const avgWin = wins.length ? grossProfit / wins.length : null;
  const avgLoss = losses.length ? -grossLoss / losses.length : null;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  const drawdown = computeDrawdown(equitySeries);
  const netContributions = initialCapital + deposits - withdrawals;
  const netReturnPct = netContributions > 0 ? ((portfolioValuePhp - netContributions) / netContributions) * 100 : null;
  const tradingPnl = portfolioValuePhp - netContributions;

  const insufficient = closed.length < 5;

  const kpis = {
    initialCapital: r2(initialCapital),
    portfolioValue: r2(portfolioValuePhp),
    realizedPnl: r2(realizedPhp),
    unrealizedPnl: r2(unrealizedPhp),
    totalFees: r2(totalFeesPhp),
    availableCash: r2(cash),
    winRate: r2(winRate),
    maxDrawdown: drawdown.pct,
    netReturnPct: r2(netReturnPct),
    tradingPnl: r2(tradingPnl),
    deposits: r2(deposits),
    withdrawals: r2(withdrawals),
    grossProfit: r2(grossProfit),
    grossLoss: r2(grossLoss),
    avgWin: r2(avgWin),
    avgLoss: r2(avgLoss),
    profitFactor: profitFactor == null ? null : r2(profitFactor),
    closedTrades: closed.length,
    openPositions: positions.length,
  };

  // ---- Risk ----
  const th = settings?.risk || {};
  const warnings = [];
  const totalValue = portfolioValuePhp > 0 ? portfolioValuePhp : 1;
  const concentrationPct = positions[0]?.marketValuePhp != null ? (positions[0].marketValuePhp / totalValue) * 100 : 0;
  const exposurePct = (holdingsValuePhp / totalValue) * 100;
  const cashPct = (cash / totalValue) * 100;
  const todayKey = periodKey(nowIso, 'daily');
  const monthKey = periodKey(nowIso, 'monthly');
  const dayPnl = realizedByPeriod.daily.get(todayKey) || 0;
  const monthPnl = realizedByPeriod.monthly.get(monthKey) || 0;
  const dayPnlPct = (dayPnl / totalValue) * 100;
  const monthPnlPct = (monthPnl / totalValue) * 100;

  const stalePrices = [];
  const staleHours = Number(th.stale_price_hours ?? 24);
  for (const p of positions) {
    if (!p.priceUpdatedAt) {
      stalePrices.push({ symbol: p.symbol, reason: 'missing' });
      continue;
    }
    const hours = (Date.now() - new Date(p.priceUpdatedAt).getTime()) / 3600000;
    if (hours > staleHours) stalePrices.push({ symbol: p.symbol, reason: 'stale', hours: r2(hours) });
  }

  const largePositions = positions.filter(
    (p) => p.marketValuePhp != null && (p.marketValuePhp / totalValue) * 100 > Number(th.large_position_pct ?? 30),
  );

  const breach = (level, code, title, detail) => warnings.push({ level, code, title, detail });

  if (concentrationPct > Number(th.max_position_pct ?? 40)) {
    breach('high', 'concentration', 'Position concentration above limit', `Top holding is ${r2(concentrationPct)}% of portfolio value (limit ${th.max_position_pct}%).`);
  }
  if (largePositions.length > 0) {
    breach('medium', 'large_position', 'Unusually large position(s) detected', `${largePositions.map((p) => p.symbol).join(', ')} exceed the large-position threshold (${th.large_position_pct}%).`);
  }
  if (dayPnlPct < -Number(th.max_daily_loss_pct ?? 3)) {
    breach('high', 'daily_loss', 'Daily loss limit breached', `Realized P&L today is ${r2(dayPnlPct)}% of portfolio value (limit -${th.max_daily_loss_pct}%).`);
  }
  if (monthPnlPct < -Number(th.max_monthly_loss_pct ?? 8)) {
    breach('high', 'monthly_loss', 'Monthly loss limit breached', `Realized P&L this month is ${r2(monthPnlPct)}% of portfolio value (limit -${th.max_monthly_loss_pct}%).`);
  }
  if (drawdown.pct != null && drawdown.pct > Number(th.max_drawdown_pct ?? 15)) {
    breach('high', 'drawdown', 'Maximum drawdown above limit', `Equity drawdown of ${drawdown.pct}% exceeds the ${th.max_drawdown_pct}% limit.`);
  }
  if (cashPct < Number(th.min_cash_pct ?? 10)) {
    breach('medium', 'low_cash', 'Available cash below minimum', `Cash is ${r2(cashPct)}% of portfolio value (minimum ${th.min_cash_pct}%).`);
  }
  if (stalePrices.length > 0) {
    breach('medium', 'stale_prices', 'Market data missing or stale', `No current price for: ${stalePrices.map((s) => s.symbol).join(', ')}. Unrealized P&L may be incomplete.`);
  }
  if (okx?.status === 'error') {
    breach('medium', 'okx_error', 'OKX synchronization error', okx.last_error || 'The last OKX sync failed.');
  }
  if (okx?.reconciliation === 'mismatch') {
    breach('high', 'reconciliation', 'Account reconciliation discrepancy', 'Local records do not match the balances reported by OKX.');
  }
  if (insufficient) {
    breach('info', 'insufficient_data', 'Insufficient completed trades', `Only ${closed.length} completed (sell) trades recorded; KPIs need at least 5 for statistical meaning.`);
  }

  const risk = {
    thresholds: th,
    exposurePct: r2(exposurePct),
    concentrationPct: r2(concentrationPct),
    concentrationSymbol: positions[0]?.symbol || null,
    cashPct: r2(cashPct),
    dayPnl: r2(dayPnl),
    dayPnlPct: r2(dayPnlPct),
    monthPnl: r2(monthPnl),
    monthPnlPct: r2(monthPnlPct),
    drawdownPct: drawdown.pct,
    largePositions: largePositions.map((p) => ({ symbol: p.symbol, pct: r2((p.marketValuePhp / totalValue) * 100) })),
    stalePrices,
    warnings,
    disclaimer:
      'Risk alerts are advisory indicators only. They do not guarantee that losses can be avoided or limited.',
  };

  return {
    meta: {
      generatedAt: nowIso,
      baseCurrency: settings?.base_currency || 'PHP',
      fxRate: fx,
      fxUpdatedAt: settings?.fx_rate?.updated_at || null,
      fxSource: settings?.fx_rate?.source || 'manual',
      initialCapital: r2(initialCapital),
      demoMode: Boolean(settings?.demo_mode),
      tradeCount: trades.length,
      pricedSymbols: Object.keys(priceMap).length,
      unpricedHoldings,
    },
    kpis,
    positions,
    equity: equitySeries,
    fees: feeSeries,
    periods: {
      daily: toSeries(realizedByPeriod.daily),
      weekly: toSeries(realizedByPeriod.weekly),
      monthly: toSeries(realizedByPeriod.monthly),
      feesDaily: toSeries(feesByPeriod.daily),
      feesWeekly: toSeries(feesByPeriod.weekly),
      feesMonthly: toSeries(feesByPeriod.monthly),
    },
    byCoin: [...byCoin.values()].map((c) => ({ ...c, realized: r2(c.realized), feesPhp: r2(c.feesPhp), volumePhp: r2(c.volumePhp), winRate: c.trades ? r2((c.wins / c.trades) * 100) : null })).sort((a, b) => b.realized - a.realized),
    byStrategy: [...byStrategy.values()].map((s) => ({ ...s, realized: r2(s.realized), feesPhp: r2(s.feesPhp), volumePhp: r2(s.volumePhp), winRate: s.trades ? r2((s.wins / s.trades) * 100) : null })).sort((a, b) => b.realized - a.realized),
    closedTrades: closed.map((c) => ({ ...c, pnl: r2(c.pnl), proceeds: r2(c.proceeds), costOut: r2(c.costOut), valuePhp: r2(c.valuePhp), feePhp: r2(c.feePhp) })),
    risk,
    drawdown,
    dataQuality: {
      insufficient,
      closedTrades: closed.length,
      unpricedHoldings,
      stalePriceCount: stalePrices.length,
      note: insufficient ? 'Insufficient data — not enough completed trades for reliable KPIs.' : null,
    },
  };
}
