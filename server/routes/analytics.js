import { Router } from 'express';
import { loadModel } from '../lib/model.js';

const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const r2 = (n) => (n == null || Number.isNaN(n) ? null : Math.round((n + Number.EPSILON) * 100) / 100);

router.get(
  '/',
  ah(async (req, res) => {
    const model = await loadModel();
    res.json(model);
  }),
);

router.post(
  '/break-even',
  ah(async (req, res) => {
    const body = req.body || {};
    const buyPrice = Number(body.buy_price);
    const qty = Number(body.quantity);
    const buyFee = Number(body.buy_fee || 0);
    const sellPct = Number(body.sell_fee_pct || 0);
    const extra = Number(body.additional_costs || 0);
    const targetPct = Number(body.target_profit_pct || 0);

    const errors = [];
    if (!Number.isFinite(buyPrice) || buyPrice <= 0) errors.push('Buy price must be greater than zero.');
    if (!Number.isFinite(qty) || qty <= 0) errors.push('Quantity must be greater than zero.');
    if (!Number.isFinite(buyFee) || buyFee < 0) errors.push('Buy fee cannot be negative.');
    if (!Number.isFinite(sellPct) || sellPct < 0 || sellPct >= 100) errors.push('Expected sell fee must be between 0 and 100 percent.');
    if (!Number.isFinite(extra) || extra < 0) errors.push('Additional costs cannot be negative.');
    if (errors.length) return res.status(400).json({ error: 'invalid_input', errors });

    const grossCost = buyPrice * qty;
    const totalAcquisitionCost = grossCost + buyFee + extra;
    const avgCostPerUnit = totalAcquisitionCost / qty;
    const netFactor = 1 - sellPct / 100;
    const breakEvenSellPrice = totalAcquisitionCost / (qty * netFactor);
    const targetSellPrice = (totalAcquisitionCost * (1 + targetPct / 100)) / (qty * netFactor);

    const grossProceeds = targetSellPrice * qty;
    const sellFee = (grossProceeds * sellPct) / 100;
    const totalFees = buyFee + sellFee;
    const grossProfit = grossProceeds - grossCost;
    const netProfit = grossProceeds - sellFee - totalAcquisitionCost;
    const netReturnPct = totalAcquisitionCost > 0 ? (netProfit / totalAcquisitionCost) * 100 : 0;

    res.json({
      pair: body.pair || null,
      inputs: { buy_price: buyPrice, quantity: qty, buy_fee: buyFee, sell_fee_pct: sellPct, additional_costs: extra, target_profit_pct: targetPct },
      outputs: {
        grossCost: r2(grossCost),
        totalAcquisitionCost: r2(totalAcquisitionCost),
        avgCostPerUnit: r2(avgCostPerUnit),
        breakEvenSellPrice: r2(breakEvenSellPrice),
        targetSellPrice: r2(targetSellPrice),
        grossProceeds: r2(grossProceeds),
        grossProfit: r2(grossProfit),
        totalFees: r2(totalFees),
        netProfit: r2(netProfit),
        netReturnPct: r2(netReturnPct),
      },
      assumptions: [
        'Costs are calculated in the quote currency of the pair (e.g. USDT for BTC/USDT).',
        'The buy fee and additional costs are treated as absolute amounts added to the acquisition cost.',
        'The expected sell fee is applied as a percentage of gross sell proceeds.',
        'Break-even assumes the full quantity is sold in a single exit at one price.',
        'No slippage, funding, or partial-exit scenarios are modelled — add them as additional costs.',
      ],
    });
  }),
);

export default router;
