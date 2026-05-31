/**
 * Claude AI Analysis Service
 *
 * Sends structured stock data to Claude and returns a plain-English
 * analysis with confidence level, risk warnings, and educational context.
 *
 * IMPORTANT DESIGN PRINCIPLE:
 * Claude is an explainer and educator here, NOT a trading oracle.
 * Every prompt is carefully designed to:
 *   1. Ground Claude in the actual data (not hallucinated prices)
 *   2. Force explicit uncertainty acknowledgment
 *   3. Prioritize risk education over buy/sell signals
 *   4. Never encourage over-confidence
 */
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Build the system prompt.
 *
 * The system prompt defines Claude's role and hard constraints.
 * It runs once per conversation and shapes every response.
 */
const SYSTEM_PROMPT = `You are a financial educator and trading mentor inside a beginner's educational stock trading app called Newbie Trader.

Your role is to explain stock data clearly to someone who is new to investing. You are NOT a financial advisor. You never give direct buy or sell commands. You explain what the data suggests, why indicators matter, what the risks are, and what a cautious beginner should consider.

STRICT RULES you always follow:
1. Never say "buy this stock" or "sell this stock" — say "the data suggests..." or "one interpretation is..."
2. Always mention at least one risk or reason the analysis could be wrong
3. Always explain what each indicator means in plain English before interpreting it
4. Confidence levels must be honest — never above 65% for a beginner strategy
5. Always remind the user this is paper trading analysis for educational purposes
6. Keep responses structured with clear sections
7. Use simple language — no jargon without explanation

Your tone is: encouraging, honest, educational, and appropriately cautious.`;

/**
 * Build the user prompt from structured stock data.
 *
 * Good prompt engineering = structured data + specific questions.
 * We give Claude the numbers and ask for interpretation,
 * not just a raw dump of data hoping it figures it out.
 *
 * @param {Object} stockData - Full response from the stock route
 * @returns {string} Formatted prompt
 */
const buildAnalysisPrompt = (stockData) => {
  const { symbol, company, price, indicators } = stockData;
  const { sma20, sma50, rsi14, interpretations } = indicators;

  return `Please analyze the following stock data for a beginner swing trader with a paper trading account. Their current total equity is approximately $10,000 (cash plus open positions).

## Stock: ${symbol} — ${company.name}
- Sector: ${company.sector ?? 'Unknown'}
- Last Close Price: $${price.close}
- Previous Open: $${price.open}
- Day High: $${price.high}  |  Day Low: $${price.low}
- Volume: ${price.volume?.toLocaleString() ?? 'Unknown'} shares
- VWAP (Volume Weighted Average Price): $${price.vwap ?? 'N/A'}

## Technical Indicators
- 20-Day Simple Moving Average (SMA20): ${sma20 ? '$' + sma20 : 'Insufficient data'}
- 50-Day Simple Moving Average (SMA50): ${sma50 ? '$' + sma50 : 'Insufficient data'}
- 14-Day RSI: ${rsi14 ?? 'Insufficient data'}

## Pre-computed Interpretations
- RSI Signal: ${interpretations.rsi.signal} — ${interpretations.rsi.description}
- Price vs SMA20: ${interpretations.priceVsSMA20.signal} — ${interpretations.priceVsSMA20.description}
- Price vs SMA50: ${interpretations.priceVsSMA50.signal} — ${interpretations.priceVsSMA50.description}

## What I need from you:
Please provide your analysis in the following exact sections:

### 1. Plain-English Summary (2-3 sentences)
What is this stock doing right now, in simple terms?

### 2. Indicator Breakdown
For each indicator (RSI, SMA20, SMA50), explain:
- What the indicator measures
- What this stock's current value means
- Whether it's a positive, negative, or neutral sign

### 3. Suggested Stop Loss
Based on the price data, where might a beginner set a stop loss, and why?
Show the math: entry price, stop loss price, risk per share.

### 4. What Could Go Wrong
List 2-3 specific reasons this analysis could be incorrect or the trade could fail.

### 5. Confidence Level
Give an honest confidence score (0-100%) that this data indicates a favorable swing trade setup.
Explain why you chose that number. Remember: be conservative.

### 6. One Thing to Learn
Suggest one investing concept this stock's current situation illustrates well, and explain it briefly.`;
};

/**
 * Main analysis function.
 *
 * @param {Object} stockData - The full stock data object from the stock route
 * @returns {Object} Parsed analysis with metadata
 */
const analyzeStock = async (stockData) => {
  const prompt = buildAnalysisPrompt(stockData);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: prompt }
    ]
  });

  const rawText = message.content[0].text;

  // Parse the confidence score out of the response
  // so the frontend can use it programmatically
  const confidenceMatch = rawText.match(/(\d{1,3})%/g);
  const confidence = confidenceMatch
    ? parseInt(confidenceMatch[confidenceMatch.length - 1])
    : null;

  return {
    symbol: stockData.symbol,
    generatedAt: new Date().toISOString(),
    analysis: rawText,
    confidence,
    model: message.model,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    },
    disclaimer: 'This analysis is for educational purposes only and does not constitute financial advice. Paper trading only.'
  };
};

/**
 * Summarize a list of news articles for a stock symbol.
 * Uses a lighter model (Haiku) since the task is simpler than full analysis.
 *
 * @param {string} symbol   - Stock ticker
 * @param {Array}  articles - Normalized articles from newsService
 * @returns {{ summary: string, sentiment: "bullish"|"bearish"|"neutral" }}
 */
const summarizeNews = async (symbol, articles) => {
  if (!articles || articles.length === 0) {
    return {
      summary: 'No recent news articles were found for this stock.',
      sentiment: 'neutral'
    };
  }

  const articleList = articles
    .map((a, i) => {
      const date = new Date(a.publishedAt).toLocaleDateString();
      const desc = a.description ? `\n   ${a.description}` : '';
      return `${i + 1}. "${a.title}" — ${a.publisher} (${date})${desc}`;
    })
    .join('\n\n');

  const prompt = `Here are recent news headlines for ${symbol}:

${articleList}

Please analyze these headlines and respond using exactly these section headers:

### Dominant Sentiment
State bullish, bearish, or neutral in the first sentence, then explain why in one more sentence.

### Headline Breakdown
For each headline (numbered to match), one plain-English sentence: what does this mean for the stock, and is it positive, negative, or neutral?

### Key Events to Watch
Are there earnings reports, Fed decisions, regulatory filings, product launches, or major corporate events mentioned? If none, say "No major scheduled events identified."

### Technical vs News Alignment
Does this news sentiment align with or contradict typical technical indicator signals a swing trader might see? What should a beginner keep in mind?`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a financial news educator inside a beginner's paper trading app called Newbie Trader. Explain financial news in plain English for someone new to investing. Never give direct buy or sell advice. Always remind the reader that news sentiment can reverse quickly and does not guarantee price movement. This is for educational purposes only.`,
    messages: [{ role: 'user', content: prompt }]
  });

  const rawText = message.content[0].text;

  // Extract sentiment from the Dominant Sentiment section
  const sentimentSection = rawText.match(/### Dominant Sentiment[\s\S]*?(?=###|$)/i)?.[0] ?? '';
  const sentimentMatch   = sentimentSection.match(/\b(bullish|bearish|neutral)\b/i);
  const sentiment        = sentimentMatch
    ? sentimentMatch[1].toLowerCase()
    : 'neutral';

  return { summary: rawText, sentiment };
};

module.exports = { analyzeStock, summarizeNews };