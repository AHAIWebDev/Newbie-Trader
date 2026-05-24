/**
 * Stock Routes
 *
 * Defines all HTTP endpoints related to stock data.
 * Each route calls services — no business logic lives here.
 */
const express = require('express');
const router = express.Router();
const polygonService = require('../services/polygonService');
const indicatorService = require('../services/indicatorService');

/**
 * GET /api/stock/:symbol
 *
 * The main endpoint. Returns everything the frontend needs
 * to display a stock: price, company info, and indicators.
 *
 * Example: GET /api/stock/AAPL
 */
router.get('/:symbol', async (req, res, next) => {
  try {
    // Sanitize input — uppercase and strip non-alpha characters
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z]/g, '');

    if (!symbol || symbol.length > 5) {
      return res.status(400).json({
        error: 'Invalid stock symbol',
        hint: 'Symbols are 1–5 uppercase letters, e.g. AAPL, MSFT, GOOGL'
      });
    }

    // Fetch data from Polygon — run company details and price data in parallel
    // Promise.all is faster than awaiting them one by one
    const [companyDetails, previousClose, historicalBars] = await Promise.all([
      polygonService.getCompanyDetails(symbol),
      polygonService.getPreviousClose(symbol),
      polygonService.getHistoricalBars(symbol, 60)
    ]);

    // Calculate technical indicators from historical data
    const indicators = indicatorService.analyzeIndicators(
      historicalBars,
      previousClose.close
    );

    // Build a human-readable summary for the AI to use later
    const summary = buildPlainEnglishSummary(companyDetails, previousClose, indicators);

    res.json({
      symbol,
      company: companyDetails,
      price: previousClose,
      indicators,
      summary,         // Plain English — ready to send to Claude in Phase 2
      historicalBars   // Chart data for the frontend
    });

  } catch (err) {
    // Pass to central error handler
    next(err);
  }
});

/**
 * GET /api/stock/:symbol/history
 *
 * Returns only historical bars — useful for chart rendering
 * without re-fetching company info.
 *
 * Query params:
 *   ?days=30  (default 60)
 */
router.get('/:symbol/history', async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z]/g, '');
    const days = Math.min(parseInt(req.query.days) || 60, 365); // cap at 1 year

    const bars = await polygonService.getHistoricalBars(symbol, days);
    res.json({ symbol, days, bars });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stock/:symbol/position-size
 *
 * Calculates how many shares to buy given risk parameters.
 *
 * Query params:
 *   ?portfolio=300&entry=150&stopLoss=142&riskPercent=1
 *
 * EDUCATIONAL: This is the most important risk management tool.
 */
router.get('/:symbol/position-size', async (req, res, next) => {
  try {
    const { portfolio, entry, stopLoss, riskPercent } = req.query;

    if (!portfolio || !entry || !stopLoss) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['portfolio', 'entry', 'stopLoss'],
        optional: ['riskPercent (default: 1)'],
        example: '/api/stock/AAPL/position-size?portfolio=300&entry=150&stopLoss=142'
      });
    }

    const result = indicatorService.calculatePositionSize(
      parseFloat(portfolio),
      parseFloat(entry),
      parseFloat(stopLoss),
      parseFloat(riskPercent) || 1
    );

    res.json(result);

  } catch (err) {
    next(err);
  }
});

/**
 * Builds a plain-English narrative from structured data.
 * This string is what we'll send to Claude in Phase 2.
 */
function buildPlainEnglishSummary(company, price, indicators) {
  const { rsi, priceVsSMA20, priceVsSMA50 } = indicators.interpretations;

  const lines = [
    `${company.name} (${company.symbol}) last closed at $${price.close}.`,
    `The stock is in the ${company.sector ?? 'unknown'} sector.`,
    priceVsSMA20.description + '.',
    priceVsSMA50.description + '.',
    rsi.description + '.',
    `Volume was ${price.volume?.toLocaleString() ?? 'unknown'} shares on the last trading day.`
  ];

  return lines.join(' ');
}

module.exports = router;