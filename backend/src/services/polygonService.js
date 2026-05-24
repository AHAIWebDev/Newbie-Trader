/**
 * Polygon.io Service — with caching
 */
const axios = require('axios');
const cache = require('./cacheService');

const BASE_URL = 'https://api.polygon.io';
const API_KEY = process.env.POLYGON_API_KEY;

const polygonClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  params: { apiKey: API_KEY }
});

const getPreviousClose = async (symbol) => {
  const cacheKey = `price:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await polygonClient.get(`/v2/aggs/ticker/${symbol}/prev`);

  if (!response.data.results || response.data.results.length === 0) {
    const error = new Error(`No data found for symbol: ${symbol}`);
    error.status = 404;
    throw error;
  }

  const result = response.data.results[0];
  const data = {
    symbol: symbol.toUpperCase(),
    open: result.o,
    high: result.h,
    low: result.l,
    close: result.c,
    volume: result.v,
    date: new Date(result.t).toISOString().split('T')[0],
    vwap: result.vw ?? null
  };

  cache.set(cacheKey, data, cache.TTL.PRICE);
  return data;
};

const getHistoricalBars = async (symbol, days = 60) => {
  const cacheKey = `history:${symbol}:${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - Math.ceil(days * 1.5));

  const formatDate = (d) => d.toISOString().split('T')[0];

  const response = await polygonClient.get(
    `/v2/aggs/ticker/${symbol}/range/1/day/${formatDate(fromDate)}/${formatDate(toDate)}`,
    { params: { adjusted: true, sort: 'asc', limit: days } }
  );

  if (!response.data.results || response.data.results.length === 0) {
    const error = new Error(`No historical data found for symbol: ${symbol}`);
    error.status = 404;
    throw error;
  }

  const data = response.data.results.map((bar) => ({
    date: new Date(bar.t).toISOString().split('T')[0],
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    vwap: bar.vw ?? null
  }));

  cache.set(cacheKey, data, cache.TTL.HISTORY);
  return data;
};

const getCompanyDetails = async (symbol) => {
  const cacheKey = `company:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await polygonClient.get(`/v3/reference/tickers/${symbol}`);

  if (!response.data.results) {
    const error = new Error(`Company details not found for: ${symbol}`);
    error.status = 404;
    throw error;
  }

  const c = response.data.results;
  const data = {
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

  cache.set(cacheKey, data, cache.TTL.COMPANY);
  return data;
};

module.exports = { getPreviousClose, getHistoricalBars, getCompanyDetails };