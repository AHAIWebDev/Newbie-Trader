/**
 * Stock API Client
 *
 * All calls to the Express backend live here.
 * Components never use fetch/axios directly —
 * they call these functions.
 *
 * This means: if the backend URL changes, you
 * only update this one file.
 */
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 60000, // 30s — AI analysis can take a moment
});

/**
 * Fetch full stock data: price, company info, indicators, chart data.
 * @param {string} symbol - e.g. "AAPL"
 */
export const getStock = async (symbol) => {
  const { data } = await client.get(`/stock/${symbol}`);
  return data;
};

/**
 * Fetch AI analysis from Claude for a given stock.
 * @param {string}  symbol
 * @param {boolean} fresh  - bypass cache if true
 */
export const getAnalysis = async (symbol, fresh = false) => {
  const { data } = await client.get(
    `/stock/${symbol}/analyze`,
    { params: fresh ? { fresh: 'true' } : {} }
  );
  return data;
};

/**
 * Calculate position size given risk parameters.
 */
export const getPositionSize = async (symbol, { portfolio, entry, stopLoss, riskPercent = 1 }) => {
  const { data } = await client.get(`/stock/${symbol}/position-size`, {
    params: { portfolio, entry, stopLoss, riskPercent }
  });
  return data;
};

/**
 * Fetch historical price bars for charting.
 * @param {string} symbol
 * @param {number} days
 */
export const getHistory = async (symbol, days = 60) => {
  const { data } = await client.get(`/stock/${symbol}/history`, {
    params: { days }
  });
  return data;
};

/**
 * Fetch recent news headlines + Claude sentiment summary for a stock.
 * @param {string}  symbol
 * @param {boolean} fresh - bypass cache if true
 */
export const getNews = async (symbol, fresh = false) => {
  const { data } = await client.get(
    `/stock/${symbol}/news`,
    { params: fresh ? { fresh: 'true' } : {} }
  );
  return data;
};

// ─── Portfolio API ────────────────────────────────────────────────────────────

/** Returns the portfolio with cash and current positions. */
export const getPortfolio = async () => {
  const { data } = await client.get('/portfolio');
  return data;
};

/**
 * Execute a buy trade.
 * @param {{ symbol, shares, price, total, reasoning, marketContext }} trade
 */
export const executeBuy = async (trade) => {
  const { data } = await client.post('/portfolio/buy', trade);
  return data;
};

/**
 * Execute a sell trade.
 * @param {{ symbol, shares, price, total, pnl, pnlPct, reasoning, marketContext }} trade
 */
export const executeSell = async (trade) => {
  const { data } = await client.post('/portfolio/sell', trade);
  return data;
};

/** Returns all trades newest-first, each with a `marketContext` object. */
export const getTrades = async () => {
  const { data } = await client.get('/portfolio/trades');
  return data;
};

/**
 * Persist outcome notes for a trade.
 * @param {number} id
 * @param {string} outcomeNotes
 */
export const updateTradeNotes = async (id, outcomeNotes) => {
  const { data } = await client.patch(`/portfolio/trades/${id}`, { outcomeNotes });
  return data;
};

/** Aggregate performance stats (win rate, total P&L, etc.). */
export const getPortfolioStats = async () => {
  const { data } = await client.get('/portfolio/stats');
  return data;
};

/**
 * Wipe all trades and positions; reset cash.
 * @param {number} startingCash
 */
export const resetPortfolio = async (startingCash = 10000) => {
  const { data } = await client.post('/portfolio/reset', { startingCash });
  return data;
};

/**
 * Returns account equity at each trade event for charting an equity curve.
 * Each point: { date, equity, event, symbol, label }
 */
export const getEquityHistory = async () => {
  const { data } = await client.get('/portfolio/equity-history');
  return data;
};

/**
 * Returns win-rate breakdown by RSI and SMA signal at time of each closed trade.
 */
export const getSignalAccuracy = async () => {
  const { data } = await client.get('/portfolio/signal-accuracy');
  return data;
};