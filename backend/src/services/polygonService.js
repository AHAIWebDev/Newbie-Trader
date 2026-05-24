/**
 * Polygon.io Service
 *
 * All communication with the Polygon.io API lives here.
 * Routes never call Polygon directly — they call these functions.
 *
 * This isolation means: if Polygon changes their API, or you want
 * to swap to a different data provider, you only change this file.
 */
const axios = require('axios');

const BASE_URL = 'https://api.polygon.io';
const API_KEY = process.env.POLYGON_API_KEY;

/**
 * Create a pre-configured axios instance for Polygon.
 * Every request automatically includes the API key.
 */
const polygonClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10 second timeout — fail fast rather than hang
  params: {
    apiKey: API_KEY
  }
});

/**
 * Get the previous day's OHLCV data for a stock.
 * OHLCV = Open, High, Low, Close, Volume
 *
 * Why previous day? The free Polygon tier has a 15-minute delay
 * on real-time data. Previous close is always available instantly
 * and is what most beginner analysis is based on anyway.
 *
 * @param {string} symbol - Stock ticker, e.g. "AAPL"
 * @returns {Object} Price data for previous trading day
 */
const getPreviousClose = async (symbol) => {
  const response = await polygonClient.get(`/v2/aggs/ticker/${symbol}/prev`);

  if (!response.data.results || response.data.results.length === 0) {
    const error = new Error(`No data found for symbol: ${symbol}`);
    error.status = 404;
    throw error;
  }

  const result = response.data.results[0];

  return {
    symbol: symbol.toUpperCase(),
    open: result.o,
    high: result.h,
    low: result.l,
    close: result.c,
    volume: result.v,
    // Polygon returns timestamps in milliseconds — convert to readable date
    date: new Date(result.t).toISOString().split('T')[0],
    // vw = volume-weighted average price — a better "average price" than simple mean
    vwap: result.vw ?? null
  };
};

/**
 * Get historical daily price bars for a stock.
 * Used to calculate moving averages and draw charts.
 *
 * @param {string} symbol - Stock ticker
 * @param {number} days   - How many trading days of history to fetch (default: 60)
 * @returns {Array} Array of daily OHLCV bars, oldest first
 */
const getHistoricalBars = async (symbol, days = 60) => {
  // Calculate date range
  const toDate = new Date();
  const fromDate = new Date();
  // Fetch extra days to account for weekends and holidays
  fromDate.setDate(fromDate.getDate() - Math.ceil(days * 1.5));

  const formatDate = (d) => d.toISOString().split('T')[0];

  const response = await polygonClient.get(
    `/v2/aggs/ticker/${symbol}/range/1/day/${formatDate(fromDate)}/${formatDate(toDate)}`,
    {
      params: {
        adjusted: true,    // Adjust for stock splits — always use this
        sort: 'asc',       // Oldest bar first
        limit: days
      }
    }
  );

  if (!response.data.results || response.data.results.length === 0) {
    const error = new Error(`No historical data found for symbol: ${symbol}`);
    error.status = 404;
    throw error;
  }

  return response.data.results.map((bar) => ({
    date: new Date(bar.t).toISOString().split('T')[0],
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    vwap: bar.vw ?? null
  }));
};

/**
 * Get company details — name, description, sector, market cap, etc.
 *
 * @param {string} symbol - Stock ticker
 * @returns {Object} Company metadata
 */
const getCompanyDetails = async (symbol) => {
  const response = await polygonClient.get(`/v3/reference/tickers/${symbol}`);

  if (!response.data.results) {
    const error = new Error(`Company details not found for: ${symbol}`);
    error.status = 404;
    throw error;
  }

  const c = response.data.results;

  return {
    symbol: c.ticker,
    name: c.name,
    description: c.description ?? null,
    sector: c.sic_description ?? null,
    marketCap: c.market_cap ?? null,
    employees: c.total_employees ?? null,
    homepage: c.homepage_url ?? null,
    listDate: c.list_date ?? null,
    currency: c.currency_name ?? 'usd'
  };
};

module.exports = {
  getPreviousClose,
  getHistoricalBars,
  getCompanyDetails
};