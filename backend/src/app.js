/**
 * Express Application Entry Point
 *
 * This file wires everything together:
 * environment variables → middleware → routes → error handling
 */

// Load .env variables FIRST — before any other imports that might need them
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const stockRoutes     = require('./routes/stock');
const portfolioRoutes = require('./routes/portfolio');
const errorHandler    = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Utility Middleware ────────────────────────────────────────────

// helmet sets secure HTTP response headers automatically
app.use(helmet());

// cors allows the React frontend (on a different port) to call this API.
// Vercel preview deployments get a unique subdomain on every push, so we
// match the whole newbie-trader-*.vercel.app family in addition to any
// explicit origins listed in FRONTEND_URL.
const VERCEL_PREVIEW_RE = /^https:\/\/newbie-trader[a-zA-Z0-9-]*\.vercel\.app$/;

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin header (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    const envOrigins = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
      : [];

    const allowed =
      DEV_ORIGINS.includes(origin) ||
      envOrigins.includes(origin) ||
      VERCEL_PREVIEW_RE.test(origin);

    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// morgan logs every request: method, path, status code, response time
// 'dev' format is colorized and readable for development
app.use(morgan('dev'));

// Parse JSON request bodies (needed for POST routes later)
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * GET /health
 * Quick endpoint to verify the server is running.
 * Used by hosting platforms and your own sanity checks.
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    config: {
      polygonApi:   !!process.env.POLYGON_API_KEY,
      anthropicApi: !!process.env.ANTHROPIC_API_KEY,
      newsApi:      !!process.env.NEWSAPI_KEY,
      database:     !!process.env.DATABASE_URL,
      frontendUrl:  process.env.FRONTEND_URL ?? 'not set'
    }
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// All stock-related routes are prefixed with /api/stock
app.use('/api/stock',      stockRoutes);
app.use('/api/portfolio',  portfolioRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableRoutes: [
      'GET /health',
      'GET /api/stock/:symbol',
      'GET /api/stock/:symbol/history?days=60',
      'GET /api/stock/:symbol/position-size?portfolio=300&entry=150&stopLoss=142'
    ]
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

// Must be registered LAST — Express identifies error handlers by the 4-parameter signature
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Stock Trader API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔑 Polygon API: ${process.env.POLYGON_API_KEY ? '✓ configured' : '✗ MISSING — check your .env file'}`);
  console.log(`\nAvailable routes:`);
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/api/stock/:symbol`);
  console.log(`  GET http://localhost:${PORT}/api/stock/:symbol/history`);
  console.log(`  GET http://localhost:${PORT}/api/stock/:symbol/position-size\n`);
});