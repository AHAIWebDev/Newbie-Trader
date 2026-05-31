/**
 * News Service
 *
 * Fetches recent news headlines for a stock symbol.
 * Primary source: Polygon.io news endpoint.
 * Fallback: NewsAPI.org when Polygon returns fewer than 3 articles.
 */
const axios = require('axios');

const POLYGON_BASE = 'https://api.polygon.io';
const NEWSAPI_BASE = 'https://newsapi.org/v2';

/**
 * Fetch news from Polygon.io.
 * Returns normalized article objects.
 */
const fetchPolygonNews = async (symbol) => {
  const response = await axios.get(`${POLYGON_BASE}/v2/reference/news`, {
    params: {
      ticker: symbol,
      limit: 5,
      order: 'desc',
      sort: 'published_utc',
      apiKey: process.env.POLYGON_API_KEY
    },
    timeout: 8000
  });

  const items = response.data.results ?? [];

  return items.map((item) => ({
    title:       item.title,
    author:      item.author ?? null,
    publishedAt: item.published_utc,
    url:         item.article_url,
    description: item.description ?? null,
    publisher:   item.publisher?.name ?? 'Unknown'
  }));
};

/**
 * Fetch news from NewsAPI.org as a fallback.
 * Skipped if NEWSAPI_KEY is not configured.
 */
const fetchNewsApiArticles = async (symbol) => {
  if (!process.env.NEWSAPI_KEY) return [];

  const response = await axios.get(`${NEWSAPI_BASE}/everything`, {
    params: {
      q:          symbol,
      sortBy:     'publishedAt',
      pageSize:   5,
      language:   'en',
      apiKey:     process.env.NEWSAPI_KEY
    },
    timeout: 8000
  });

  const items = response.data.articles ?? [];

  return items
    .filter((a) => a.title && a.title !== '[Removed]')
    .map((item) => ({
      title:       item.title,
      author:      item.author ?? null,
      publishedAt: item.publishedAt,
      url:         item.url,
      description: item.description ?? null,
      publisher:   item.source?.name ?? 'Unknown'
    }));
};

/**
 * Get up to 5 recent news articles for a symbol.
 * Uses Polygon first; supplements with NewsAPI when fewer than 3 results.
 *
 * @param {string} symbol - Stock ticker, e.g. "AAPL"
 * @returns {Array} Normalized article objects, newest first, max 5
 */
const getNews = async (symbol) => {
  let articles = [];

  try {
    articles = await fetchPolygonNews(symbol);
  } catch (err) {
    console.warn(`[News] Polygon news fetch failed for ${symbol}:`, err.message);
  }

  if (articles.length < 3) {
    try {
      const supplemental = await fetchNewsApiArticles(symbol);
      const seen = new Set(articles.map((a) => a.url));
      for (const a of supplemental) {
        if (!seen.has(a.url)) {
          articles.push(a);
          seen.add(a.url);
        }
      }
    } catch (err) {
      console.warn(`[News] NewsAPI fallback failed for ${symbol}:`, err.message);
    }
  }

  return articles
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 5);
};

module.exports = { getNews };
