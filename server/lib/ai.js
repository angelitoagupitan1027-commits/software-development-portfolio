// Marco AI advisor.
// Facts come from deterministic analytics; the model only interprets verified metrics.
// The provider key stays server-side and is never exposed to the browser.

const NOT_CONFIGURED_MESSAGE =
  'Marco AI is not connected. No AI provider is configured on the server, so no AI analysis can be generated. ' +
  'Add an OPENAI_API_KEY in the app secrets to enable conversational analysis. ' +
  'The verified metrics below are computed directly from your stored records and are available now.';

export function aiStatus() {
  const key = process.env.OPENAI_API_KEY;
  return {
    configured: Boolean(key),
    provider: key ? 'openai' : null,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

const peso = (n) => (n == null ? 'n/a' : `PHP ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

// Compact, factual digest of the verified metrics — the grounding context for any answer.
export function buildDigest(model) {
  const k = model.kpis;
  const lines = [];
  lines.push(`As of: ${model.meta.generatedAt}`);
  lines.push(`Data mode: ${model.meta.demoMode ? 'DEMO DATA (sample records, not real results)' : 'REAL RECORDS ONLY'}`);
  lines.push(`Records on file: ${model.meta.tradeCount} trades, ${k.closedTrades} completed (sell) trades.`);
  lines.push('');
  lines.push('VERIFIED METRICS (computed by deterministic application code):');
  lines.push(`- Initial capital: ${peso(k.initialCapital)}`);
  lines.push(`- Current portfolio value: ${peso(k.portfolioValue)}`);
  lines.push(`- Realized P&L: ${peso(k.realizedPnl)}`);
  lines.push(`- Unrealized P&L: ${peso(k.unrealizedPnl)}`);
  lines.push(`- Total trading fees: ${peso(k.totalFees)}`);
  lines.push(`- Available cash: ${peso(k.availableCash)}`);
  lines.push(`- Deposits: ${peso(k.deposits)} | Withdrawals: ${peso(k.withdrawals)} (not counted as trading profit)`);
  lines.push(`- Trading P&L (portfolio value less net contributions): ${peso(k.tradingPnl)}`);
  lines.push(`- Net return: ${k.netReturnPct == null ? 'n/a' : `${k.netReturnPct}%`}`);
  lines.push(`- Win rate: ${k.winRate == null ? 'n/a' : `${k.winRate}%`} over ${k.closedTrades} closed trades`);
  lines.push(`- Average winning trade: ${peso(k.avgWin)} | Average losing trade: ${peso(k.avgLoss)}`);
  lines.push(`- Profit factor: ${k.profitFactor == null ? 'n/a' : k.profitFactor}`);
  lines.push(`- Maximum drawdown: ${k.maxDrawdown == null ? 'n/a' : `${k.maxDrawdown}%`}`);
  lines.push(`- FX rate used: 1 USDT = ${model.meta.fxRate} PHP (updated ${model.meta.fxUpdatedAt || 'n/a'})`);
  lines.push('');
  lines.push('PORTFOLIO EXPOSURE:');
  lines.push(`- Invested exposure: ${model.risk.exposurePct}% of portfolio value; cash: ${model.risk.cashPct}%.`);
  if (model.positions.length === 0) lines.push('- No open holdings recorded.');
  for (const p of model.positions) {
    lines.push(`- ${p.symbol}: qty ${p.quantity}, avg cost ${peso(p.avgCostPhp)}, market value ${peso(p.marketValuePhp)}, unrealized ${peso(p.unrealizedPhp)}`);
  }
  lines.push('');
  lines.push('PERFORMANCE BY STRATEGY:');
  if (model.byStrategy.length === 0) lines.push('- No completed trades by strategy yet.');
  for (const s of model.byStrategy) lines.push(`- ${s.key}: realized ${peso(s.realized)}, ${s.trades} closed trades, win rate ${s.winRate == null ? 'n/a' : `${s.winRate}%`}`);
  lines.push('');
  lines.push('PERFORMANCE BY COIN:');
  if (model.byCoin.length === 0) lines.push('- No completed trades by coin yet.');
  for (const c of model.byCoin) lines.push(`- ${c.key}: realized ${peso(c.realized)}, ${c.trades} closed trades`);
  lines.push('');
  lines.push('RISK WARNINGS:');
  if (model.risk.warnings.length === 0) lines.push('- No thresholds breached.');
  for (const w of model.risk.warnings) lines.push(`- [${w.level}] ${w.title}: ${w.detail}`);
  lines.push('');
  lines.push('DATA QUALITY:');
  lines.push(`- ${model.dataQuality.insufficient ? 'INSUFFICIENT DATA for statistically meaningful KPIs.' : 'Sufficient completed trades for KPI calculation.'}`);
  if (model.dataQuality.unpricedHoldings) lines.push(`- ${model.dataQuality.unpricedHoldings} holding(s) have no market price; unrealized P&L is incomplete.`);
  if (model.dataQuality.stalePriceCount) lines.push(`- ${model.dataQuality.stalePriceCount} symbol(s) have missing or stale prices.`);
  lines.push(`- OKX connection: ${model.okx?.status || 'disconnected'} (last sync: ${model.okx?.last_sync || 'never'}).`);
  return lines.join('\n');
}

const SYSTEM_PROMPT = [
  'You are Marco AI, the analyst for a personal OKX Spot trading business.',
  'You act as: Trading Business Analyst, Financial Performance Analyst, Risk Management Analyst, Trading Strategy Reviewer, and Business Intelligence Advisor.',
  'Rules you must always follow:',
  '- Use ONLY the verified metrics supplied in the context. Never invent balances, trades, prices, or profitability.',
  '- Clearly separate FACTS (from the metrics) from HYPOTHESES (your interpretation). Label hypotheses as such.',
  '- Explain reasoning by citing the specific supporting metrics.',
  '- State explicitly what data is missing or insufficient, and express uncertainty honestly.',
  '- Never guarantee profits and never claim to predict the market with certainty.',
  '- Note when figures come from DEMO DATA.',
  '- Be concise, structured, and professional. Use short sections and bullet points.',
].join('\n');

export async function askMarco({ question, digest, history }) {
  const status = aiStatus();
  if (!status.configured) {
    return { configured: false, answer: null, notice: NOT_CONFIGURED_MESSAGE };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `VERIFIED METRICS CONTEXT:\n${digest}` },
  ];
  for (const m of (history || []).slice(-8)) {
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) });
  }
  messages.push({ role: 'user', content: question });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: status.model,
      messages,
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`AI provider error (HTTP ${res.status}). ${text.slice(0, 300)}`);
    err.code = 'AI_ERROR';
    throw err;
  }
  const json = await res.json();
  const answer = json?.choices?.[0]?.message?.content || 'The AI provider returned an empty response.';
  return { configured: true, answer, notice: null, model: status.model };
}

export { NOT_CONFIGURED_MESSAGE };
