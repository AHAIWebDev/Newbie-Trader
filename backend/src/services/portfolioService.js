const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PORTFOLIO_ID = 1;

// ─── Portfolio ────────────────────────────────────────────────────────────────

async function getOrCreatePortfolio() {
  return prisma.portfolio.upsert({
    where:  { id: PORTFOLIO_ID },
    update: {},
    create: { id: PORTFOLIO_ID, cash: 10000, startingCash: 10000 },
  });
}

async function getPortfolioWithPositions() {
  await getOrCreatePortfolio();
  return prisma.portfolio.findUnique({
    where:   { id: PORTFOLIO_ID },
    include: { positions: { orderBy: { addedAt: 'asc' } } },
  });
}

// ─── Positions ────────────────────────────────────────────────────────────────

async function upsertPosition({ symbol, shares, avgCost, lastPrice }) {
  if (shares <= 0) {
    return prisma.position.deleteMany({
      where: { portfolioId: PORTFOLIO_ID, symbol },
    });
  }
  return prisma.position.upsert({
    where:  { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol } },
    update: { shares, avgCost, lastPrice },
    create: { portfolioId: PORTFOLIO_ID, symbol, shares, avgCost, lastPrice },
  });
}

// ─── Trades ───────────────────────────────────────────────────────────────────

async function createTrade(fields) {
  return prisma.trade.create({
    data: { portfolioId: PORTFOLIO_ID, ...fields },
  });
}

async function getTrades() {
  return prisma.trade.findMany({
    where:   { portfolioId: PORTFOLIO_ID },
    orderBy: { date: 'desc' },
  });
}

async function updateTradeNotes(id, outcomeNotes) {
  return prisma.trade.update({
    where: { id },
    data:  { outcomeNotes },
  });
}

// ─── Buy / Sell (transactional) ───────────────────────────────────────────────

async function executeBuy({ symbol, shares, price, total, reasoning, marketContext }) {
  return prisma.$transaction(async (tx) => {
    const portfolio = await tx.portfolio.upsert({
      where:  { id: PORTFOLIO_ID },
      update: {},
      create: { id: PORTFOLIO_ID, cash: 10000, startingCash: 10000 },
    });

    if (total > portfolio.cash) {
      const err = new Error('Insufficient cash');
      err.status = 400;
      throw err;
    }

    // Avg-cost calculation for existing position
    const existing = await tx.position.findUnique({
      where: { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol } },
    });

    let newShares, newAvgCost;
    if (existing) {
      newShares  = existing.shares + shares;
      newAvgCost = (existing.shares * existing.avgCost + shares * price) / newShares;
    } else {
      newShares  = shares;
      newAvgCost = price;
    }

    await tx.position.upsert({
      where:  { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol } },
      update: { shares: newShares, avgCost: parseFloat(newAvgCost.toFixed(4)), lastPrice: price },
      create: { portfolioId: PORTFOLIO_ID, symbol, shares: newShares, avgCost: price, lastPrice: price },
    });

    const newCash = parseFloat((portfolio.cash - total).toFixed(2));
    await tx.portfolio.update({
      where: { id: PORTFOLIO_ID },
      data:  { cash: newCash },
    });

    const trade = await tx.trade.create({
      data: {
        portfolioId:  PORTFOLIO_ID,
        type:         'BUY',
        symbol,
        shares,
        price,
        total,
        reasoning,
        rsiValue:     marketContext?.rsiValue     ?? null,
        rsiSignal:    marketContext?.rsiSignal     ?? null,
        sma20Signal:  marketContext?.sma20Signal   ?? null,
        sma50Signal:  marketContext?.sma50Signal   ?? null,
        aiConfidence: marketContext?.aiConfidence  ?? null,
        aiAnalyzedAt: marketContext?.aiAnalyzedAt  ?? null,
      },
    });

    return { trade, cash: newCash };
  });
}

async function executeSell({ symbol, shares, price, total, pnl, pnlPct, reasoning, marketContext }) {
  return prisma.$transaction(async (tx) => {
    const position = await tx.position.findUnique({
      where: { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol } },
    });

    if (!position) {
      const err = new Error(`No position found for ${symbol}`);
      err.status = 400;
      throw err;
    }
    if (shares > position.shares) {
      const err = new Error(`Cannot sell ${shares} shares — only own ${position.shares}`);
      err.status = 400;
      throw err;
    }

    const remaining = position.shares - shares;
    if (remaining === 0) {
      await tx.position.delete({
        where: { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol } },
      });
    } else {
      await tx.position.update({
        where: { portfolioId_symbol: { portfolioId: PORTFOLIO_ID, symbol } },
        data:  { shares: remaining, lastPrice: price },
      });
    }

    const portfolio = await tx.portfolio.findUnique({ where: { id: PORTFOLIO_ID } });
    const newCash = parseFloat((portfolio.cash + total).toFixed(2));
    await tx.portfolio.update({
      where: { id: PORTFOLIO_ID },
      data:  { cash: newCash },
    });

    const trade = await tx.trade.create({
      data: {
        portfolioId:  PORTFOLIO_ID,
        type:         'SELL',
        symbol,
        shares,
        price,
        total,
        pnl:          pnl   ?? null,
        pnlPct:       pnlPct ?? null,
        reasoning,
        rsiValue:     marketContext?.rsiValue     ?? null,
        rsiSignal:    marketContext?.rsiSignal     ?? null,
        sma20Signal:  marketContext?.sma20Signal   ?? null,
        sma50Signal:  marketContext?.sma50Signal   ?? null,
        aiConfidence: marketContext?.aiConfidence  ?? null,
        aiAnalyzedAt: marketContext?.aiAnalyzedAt  ?? null,
      },
    });

    return { trade, cash: newCash };
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function getPerformanceStats() {
  const trades  = await getTrades();
  const sells   = trades.filter(t => t.type === 'SELL' && t.pnl != null);
  const wins    = sells.filter(t => t.pnl > 0);
  const losses  = sells.filter(t => t.pnl < 0);
  const totalPnl = sells.reduce((s, t) => s + t.pnl, 0);

  return {
    totalTrades:  trades.length,
    closedTrades: sells.length,
    winCount:     wins.length,
    lossCount:    losses.length,
    winRate:      sells.length > 0 ? (wins.length / sells.length) * 100 : null,
    totalPnl,
    avgWin:       wins.length   > 0 ? wins.reduce((s, t)   => s + t.pnl, 0) / wins.length   : null,
    avgLoss:      losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : null,
    bestTrade:    sells.reduce((b, t) => (!b || t.pnl > b.pnl ? t : b), null),
    worstTrade:   sells.reduce((w, t) => (!w || t.pnl < w.pnl ? t : w), null),
  };
}

// ─── Reset ────────────────────────────────────────────────────────────────────

async function resetPortfolio(startingCash) {
  return prisma.$transaction(async (tx) => {
    await tx.trade.deleteMany(    { where: { portfolioId: PORTFOLIO_ID } });
    await tx.position.deleteMany( { where: { portfolioId: PORTFOLIO_ID } });
    return tx.portfolio.upsert({
      where:  { id: PORTFOLIO_ID },
      update: { cash: startingCash, startingCash },
      create: { id: PORTFOLIO_ID, cash: startingCash, startingCash },
    });
  });
}

// ─── Serialization helper ─────────────────────────────────────────────────────

// Reconstructs the `marketContext` object the frontend expects from flat DB columns.
function serializeTrade(trade) {
  const { rsiValue, rsiSignal, sma20Signal, sma50Signal, aiConfidence, aiAnalyzedAt, ...rest } = trade;
  return {
    ...rest,
    marketContext: { rsiValue, rsiSignal, sma20Signal, sma50Signal, aiConfidence, aiAnalyzedAt },
  };
}

module.exports = {
  getOrCreatePortfolio,
  getPortfolioWithPositions,
  upsertPosition,
  createTrade,
  getTrades,
  updateTradeNotes,
  executeBuy,
  executeSell,
  getPerformanceStats,
  resetPortfolio,
  serializeTrade,
};
