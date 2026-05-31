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

// ─── Equity history ───────────────────────────────────────────────────────────

// Replays all trades chronologically to produce an equity curve.
// Equity at each point = cash + Σ(shares × lastTradePrice) for open positions.
async function getEquityHistory() {
  const portfolio = await getOrCreatePortfolio();
  const trades = await prisma.trade.findMany({
    where:   { portfolioId: PORTFOLIO_ID },
    orderBy: { date: 'asc' },
  });

  if (trades.length === 0) {
    return [{ date: portfolio.createdAt.toISOString(), equity: portfolio.startingCash, event: 'start' }];
  }

  const points = [];
  let cash = portfolio.startingCash;
  const positions = {}; // symbol → { shares, avgCost, lastPrice }

  // Anchor point one second before the first trade
  points.push({
    date:   new Date(new Date(trades[0].date).getTime() - 1000).toISOString(),
    equity: portfolio.startingCash,
    event:  'start',
    label:  'Start',
  });

  for (const trade of trades) {
    if (trade.type === 'BUY') {
      cash -= trade.total;
      const ex = positions[trade.symbol];
      if (ex) {
        const totalShares = ex.shares + trade.shares;
        const avgCost = (ex.shares * ex.avgCost + trade.shares * trade.price) / totalShares;
        positions[trade.symbol] = { shares: totalShares, avgCost, lastPrice: trade.price };
      } else {
        positions[trade.symbol] = { shares: trade.shares, avgCost: trade.price, lastPrice: trade.price };
      }
    } else {
      cash += trade.total;
      const pos = positions[trade.symbol];
      if (pos) {
        const remaining = pos.shares - trade.shares;
        if (remaining <= 0) {
          delete positions[trade.symbol];
        } else {
          positions[trade.symbol] = { ...pos, shares: remaining, lastPrice: trade.price };
        }
      }
    }

    const positionValue = Object.values(positions).reduce(
      (sum, pos) => sum + pos.shares * pos.lastPrice, 0
    );

    points.push({
      date:   new Date(trade.date).toISOString(),
      equity: parseFloat((cash + positionValue).toFixed(2)),
      event:  trade.type,
      symbol: trade.symbol,
      label:  `${trade.type} ${trade.symbol}`,
    });
  }

  return points;
}

// ─── Signal accuracy ──────────────────────────────────────────────────────────

// Breaks down closed SELL trades by the RSI and SMA signals present at sell time.
async function getSignalAccuracy() {
  const trades = await prisma.trade.findMany({
    where: { portfolioId: PORTFOLIO_ID, type: 'SELL' },
  });

  const closed = trades.filter(t => t.pnl != null);
  if (closed.length === 0) return { rsi: [], sma: [], totalClosedTrades: 0 };

  const rsiGroups = {};
  const smaGroups = {};

  for (const t of closed) {
    // RSI grouping
    const rsiKey = t.rsiSignal || 'unknown';
    if (!rsiGroups[rsiKey]) rsiGroups[rsiKey] = { signal: rsiKey, count: 0, wins: 0, totalPnl: 0 };
    rsiGroups[rsiKey].count++;
    if (t.pnl > 0) rsiGroups[rsiKey].wins++;
    rsiGroups[rsiKey].totalPnl += t.pnl;

    // SMA trend grouping
    const hasSma = t.sma20Signal && t.sma50Signal &&
                   t.sma20Signal !== 'unknown' && t.sma50Signal !== 'unknown';
    if (hasSma) {
      const smaKey = t.sma20Signal === 'bullish' && t.sma50Signal === 'bullish' ? 'Both Bullish'
                   : t.sma20Signal === 'bearish' && t.sma50Signal === 'bearish' ? 'Both Bearish'
                   : 'Mixed';
      if (!smaGroups[smaKey]) smaGroups[smaKey] = { signal: smaKey, count: 0, wins: 0, totalPnl: 0 };
      smaGroups[smaKey].count++;
      if (t.pnl > 0) smaGroups[smaKey].wins++;
      smaGroups[smaKey].totalPnl += t.pnl;
    }
  }

  const toRow = g => ({
    signal:   g.signal,
    count:    g.count,
    wins:     g.wins,
    losses:   g.count - g.wins,
    winRate:  parseFloat(((g.wins / g.count) * 100).toFixed(0)),
    avgPnl:   parseFloat((g.totalPnl / g.count).toFixed(2)),
    totalPnl: parseFloat(g.totalPnl.toFixed(2)),
  });

  return {
    rsi:               Object.values(rsiGroups).map(toRow).sort((a, b) => b.count - a.count),
    sma:               Object.values(smaGroups).map(toRow).sort((a, b) => b.count - a.count),
    totalClosedTrades: closed.length,
  };
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
  getEquityHistory,
  getSignalAccuracy,
  resetPortfolio,
  serializeTrade,
};
