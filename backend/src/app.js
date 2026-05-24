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

const stockRoutes = require('./routes/stock');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Utility Middleware ────────────────────────────────────────────

// helmet sets secure HTTP response headers automatically
app.use(helmet());

// cors allows the React frontend (on a different port) to call this API
// In production you'd restrict this to your specific domain
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-production-domain.com'
    : ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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
    polygonConfigured: !!process.env.POLYGON_API_KEY
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// All stock-related routes are prefixed with /api/stock
app.use('/api/stock', stockRoutes);

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