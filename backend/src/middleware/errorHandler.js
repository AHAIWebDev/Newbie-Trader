/**
 * Central error handling middleware.
 *
 * In Express, any middleware with 4 parameters (err, req, res, next)
 * is automatically treated as an error handler.
 *
 * Why centralize errors? So every route doesn't need its own try/catch
 * display logic. They just call next(error) and this takes over.
 */
const errorHandler = (err, req, res, next) => {
  // Log full error details on the server (never send stack traces to clients)
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // If the error came from an external API call (like Polygon.io)
  if (err.response) {
    const status = err.response.status;
    const apiMessage = err.response.data?.message || err.response.data?.error || 'External API error';

    // Pass through 401 Unauthorized (bad API key) and 429 Too Many Requests (rate limit)
    if (status === 401) {
      return res.status(401).json({
        error: 'Invalid or missing API key',
        hint: 'Check your POLYGON_API_KEY in the .env file'
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        hint: 'Polygon free tier allows 5 requests/minute. Wait a moment and try again.'
      });
    }

    return res.status(status).json({ error: apiMessage });
  }

  // Generic server error — use err.status if set, otherwise 500
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;