/**
 * Technical Indicator Service
 *
 * Calculates indicators from raw price data.
 * These are the building blocks of technical analysis.
 *
 * EDUCATIONAL NOTE: Technical indicators are mathematical formulas
 * applied to price and volume data. They are descriptive (they tell you
 * what has happened) but NOT predictive on their own. Always combine
 * multiple signals and use risk management regardless.
 */

/**
 * Simple Moving Average (SMA)
 *
 * The average closing price over the last N days.
 * A 50-day SMA above price = potential downtrend.
 * A 50-day SMA below price = potential uptrend.
 *
 * @param {number[]} closes - Array of closing prices, oldest first
 * @param {number}   period - Number of days to average (e.g., 20, 50, 200)
 * @returns {number|null} The SMA value, or null if not enough data
 */
const calculateSMA = (closes, period) => {
  if (closes.length < period) return null;
  const slice = closes.slice(-period); // Take the last N prices
  const sum = slice.reduce((acc, price) => acc + price, 0);
  return parseFloat((sum / period).toFixed(2));
};

/**
 * Relative Strength Index (RSI)
 *
 * Measures momentum — how fast and how much prices are changing.
 * Scale: 0 to 100
 *   RSI > 70 = "overbought" (may be due for a pullback — caution buying)
 *   RSI < 30 = "oversold"   (may be due for a bounce — caution selling)
 *   RSI 40–60 = neutral zone (generally safer entry region)
 *
 * Standard period is 14 days (Wilder's original recommendation).
 *
 * @param {number[]} closes - Closing prices, oldest first
 * @param {number}   period - Lookback period (default 14)
 * @returns {number|null} RSI value 0–100
 */
const calculateRSI = (closes, period = 14) => {
  if (closes.length < period + 1) return null;

  // We need period+1 prices to get period price changes
  const recentCloses = closes.slice(-(period + 1));

  // Step 1: Calculate all daily price changes
  const changes = [];
  for (let i = 1; i < recentCloses.length; i++) {
    changes.push(recentCloses[i] - recentCloses[i - 1]);
  }

  // Step 2: Separate gains and losses
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));

  // Step 3: Average gain and average loss over the period
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  // Step 4: Relative Strength = avgGain / avgLoss
  // Edge case: if no losses at all, RSI is 100 (perfectly overbought)
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;

  // Step 5: Convert RS to 0–100 scale
  const rsi = 100 - 100 / (1 + rs);

  return parseFloat(rsi.toFixed(2));
};

/**
 * Interpret RSI into a plain-English signal.
 * This is used by the AI context builder.
 */
const interpretRSI = (rsi) => {
  if (rsi === null) return { signal: 'unknown', description: 'Not enough data to calculate RSI' };
  if (rsi >= 70) return { signal: 'overbought', description: `RSI of ${rsi} suggests the stock may be overbought — recent gains may be overextended` };
  if (rsi <= 30) return { signal: 'oversold', description: `RSI of ${rsi} suggests the stock may be oversold — recent losses may be overextended` };
  if (rsi >= 55) return { signal: 'bullish', description: `RSI of ${rsi} shows bullish momentum without being overbought` };
  if (rsi <= 45) return { signal: 'bearish', description: `RSI of ${rsi} shows bearish momentum without being oversold` };
  return { signal: 'neutral', description: `RSI of ${rsi} is in the neutral zone — no strong momentum signal` };
};

/**
 * Price vs Moving Average interpretation.
 */
const interpretPriceVsSMA = (price, sma, period) => {
  if (sma === null) return { signal: 'unknown', description: `Not enough data for ${period}-day SMA` };
  const percentDiff = (((price - sma) / sma) * 100).toFixed(2);
  const direction = price > sma ? 'above' : 'below';
  const signal = price > sma ? 'bullish' : 'bearish';
  return {
    signal,
    description: `Price is ${direction} the ${period}-day moving average by ${Math.abs(percentDiff)}%`,
    percentDiff: parseFloat(percentDiff)
  };
};

/**
 * Calculate position size based on the 1% risk rule.
 *
 * EDUCATIONAL NOTE: Position sizing is arguably the most important
 * risk management concept. It answers: "How many shares should I buy?"
 * The formula ensures a single trade can never destroy your account.
 *
 * Formula: shares = (portfolioSize * riskPercent) / (entryPrice - stopLossPrice)
 *
 * @param {number} portfolioValue - Total portfolio size in dollars
 * @param {number} entryPrice     - Price you plan to buy at
 * @param {number} stopLossPrice  - Price at which you'll sell to limit loss
 * @param {number} riskPercent    - Max % of portfolio to risk (default 1%)
 * @returns {Object} Position sizing recommendation with explanation
 */
const calculatePositionSize = (portfolioValue, entryPrice, stopLossPrice, riskPercent = 1) => {
  const riskAmount = portfolioValue * (riskPercent / 100);
  const riskPerShare = entryPrice - stopLossPrice;

  if (riskPerShare <= 0) {
    return { error: 'Stop loss must be below entry price' };
  }

  const shares = Math.floor(riskAmount / riskPerShare);
  const totalCost = shares * entryPrice;
  const maxLoss = shares * riskPerShare;

  return {
    recommendedShares: shares,
    totalCost: parseFloat(totalCost.toFixed(2)),
    maxLoss: parseFloat(maxLoss.toFixed(2)),
    riskAmount: parseFloat(riskAmount.toFixed(2)),
    riskPercent,
    explanation: `Risking ${riskPercent}% of $${portfolioValue} = $${riskAmount.toFixed(2)}. ` +
      `With a stop loss $${riskPerShare.toFixed(2)} below entry, ` +
      `you can buy ${shares} shares for $${totalCost.toFixed(2)}.`
  };
};

/**
 * Master function: run all indicators on a set of historical bars.
 *
 * @param {Array}  bars         - Historical price bars from polygonService
 * @param {number} currentPrice - Most recent price
 * @returns {Object} All computed indicators + interpretations
 */
const analyzeIndicators = (bars, currentPrice) => {
  const closes = bars.map((b) => b.close);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsi14 = calculateRSI(closes, 14);

  return {
    currentPrice,
    sma20,
    sma50,
    rsi14,
    interpretations: {
      rsi: interpretRSI(rsi14),
      priceVsSMA20: interpretPriceVsSMA(currentPrice, sma20, 20),
      priceVsSMA50: interpretPriceVsSMA(currentPrice, sma50, 50)
    }
  };
};

module.exports = {
  calculateSMA,
  calculateRSI,
  interpretRSI,
  interpretPriceVsSMA,
  calculatePositionSize,
  analyzeIndicators
};