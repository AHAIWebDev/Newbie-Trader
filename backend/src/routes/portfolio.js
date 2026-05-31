const express = require('express');
const router  = express.Router();
const svc     = require('../services/portfolioService');

/**
 * GET /api/portfolio
 * Returns portfolio summary + current positions.
 */
router.get('/', async (req, res, next) => {
  try {
    const portfolio = await svc.getPortfolioWithPositions();
    res.json(portfolio);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/buy
 * Body: { symbol, shares, price, total, reasoning, marketContext }
 */
router.post('/buy', async (req, res, next) => {
  try {
    const { symbol, shares, price, total, reasoning, marketContext } = req.body;

    if (!symbol || !shares || !price || !total || !reasoning) {
      return res.status(400).json({ error: 'Missing required fields: symbol, shares, price, total, reasoning' });
    }

    const result = await svc.executeBuy({ symbol, shares, price, total, reasoning, marketContext });
    res.json({ trade: svc.serializeTrade(result.trade), cash: result.cash });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/portfolio/sell
 * Body: { symbol, shares, price, total, pnl, pnlPct, reasoning, marketContext }
 */
router.post('/sell', async (req, res, next) => {
  try {
    const { symbol, shares, price, total, pnl, pnlPct, reasoning, marketContext } = req.body;

    if (!symbol || !shares || !price || !total || !reasoning) {
      return res.status(400).json({ error: 'Missing required fields: symbol, shares, price, total, reasoning' });
    }

    const result = await svc.executeSell({ symbol, shares, price, total, pnl, pnlPct, reasoning, marketContext });
    res.json({ trade: svc.serializeTrade(result.trade), cash: result.cash });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/portfolio/trades
 * Returns all trades newest-first, with marketContext reconstructed.
 */
router.get('/trades', async (req, res, next) => {
  try {
    const trades = await svc.getTrades();
    res.json(trades.map(svc.serializeTrade));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/portfolio/trades/:id
 * Body: { outcomeNotes }
 */
router.patch('/trades/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { outcomeNotes } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid trade id' });
    }

    const trade = await svc.updateTradeNotes(id, outcomeNotes ?? '');
    res.json(svc.serializeTrade(trade));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portfolio/stats
 * Returns aggregate performance statistics.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await svc.getPerformanceStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/reset
 * Body: { startingCash }  (default 10000)
 * Wipes all trades and positions, resets cash.
 */
router.post('/reset', async (req, res, next) => {
  try {
    const startingCash = parseFloat(req.body.startingCash) || 10000;

    if (startingCash <= 0) {
      return res.status(400).json({ error: 'startingCash must be greater than 0' });
    }

    const portfolio = await svc.resetPortfolio(startingCash);
    res.json(portfolio);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
