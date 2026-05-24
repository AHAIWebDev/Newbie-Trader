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
  timeout: 30000, // 30s — AI analysis can take a moment
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