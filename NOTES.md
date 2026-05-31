# Newbie Trader — Project Notes

Last updated: 2026-05-30

---

## Completed phases

### Phase 1 — Backend API
- Express server (helmet, cors, morgan, dotenv)
- Polygon.io service: `getPreviousClose`, `getHistoricalBars`, `getCompanyDetails`
- Technical indicator service: SMA20, SMA50, RSI14, position sizing (1% rule)
- Routes: `GET /api/stock/:symbol`, `/history`, `/position-size`, `/analyze`
- Central error handler, plain-English summary builder

### Phase 2 — Claude AI Analysis
- `claudeService.analyzeStock()` — structured 6-section prompt to Claude
- System prompt enforces educational tone, never "buy/sell" commands
- `cacheService` (node-cache): PRICE 5m, COMPANY 24h, ANALYSIS 10m, HISTORY 15m
- 55-second timeout guard on `/analyze`; 2-attempt retry in frontend `AnalysisCard`

### Phase 3 — React Frontend
- Vite + React 19 + Tailwind v4 (`@tailwindcss/vite`, `@theme` block in `index.css`)
- Components: `SearchBar`, `StockHeader`, `PriceChart`, `IndicatorPanel`,
  `AnalysisCard`, `PositionSizer`, `Portfolio`
- Vite proxy: `/api → http://localhost:3001` in dev

### Phase 4A — Trade Journal
- `TradeModal`: intercepts every buy/sell, requires written reasoning, snapshots
  RSI/SMA/AI confidence at trade time
- `JournalEntry`: expandable card, editable outcome notes
- `JournalPage`: stats (win rate, avg win/loss, best/worst), filters, symbol search
- `Portfolio`: uses `TradeModal`, tracks cash + positions, total equity, return %
- All data persisted in `localStorage` key `newbie-trader-portfolio`
- `App.jsx`: BrowserRouter, persistent TopNav (Analyze / Journal)

### Phase 4B — News Panel (completed 2026-05-30)
- `newsService.js`: Polygon `/v2/reference/news` primary; NewsAPI.org fallback
  when Polygon returns < 3 results; deduplicates by URL; newest-first, max 5
- `claudeService.summarizeNews()`: `claude-haiku-4-5-20251001`, 600 tokens,
  4 sections (Dominant Sentiment / Headline Breakdown / Key Events /
  Technical vs News Alignment), sentiment extracted via regex
- Route: `GET /api/stock/:symbol/news` — 15-min cache, `?fresh=true` bypass
- `NewsPanel.jsx`: auto-fetches on stock symbol change (no button needed);
  clickable article cards (open in new tab); sentiment badge; Claude summary;
  Refresh button; loading skeletons; educational note at bottom
- NEWS TTL constant added to `cacheService`
- `NEWSAPI_KEY` documented in `.env.example` as optional

---

## Known bugs / rough edges

1. **NewsAPI articles not always stock-specific.** The NewsAPI `?q=SYMBOL` query
   matches the ticker string anywhere in an article, which occasionally returns
   loosely related articles (e.g. searching AAPL returns "Apple sauce" recipes on
   some symbols). Polygon results are accurate; the issue only appears when the
   NewsAPI fallback fires. Mitigation: restrict to `searchIn=title` in the
   NewsAPI params, or add a relevance filter.

2. **News panel shows on cold cache, then flickers to cached on Refresh.**
   Minor UX issue — the "cached" badge disappears between the Refresh click and
   the response. Not a functional bug.

3. **localhost-only headless browser testing.** WSL2 is missing `libatk-1.0.so.0`
   (requires root to install), so automated screenshot tests can't run in this
   environment. All API behavior was verified via `curl`; UI must be verified
   manually in a browser.

4. **`localStorage` has no size guard.** After many trades the stored JSON could
   approach browser limits (~5 MB). Resolved by Phase 4C (database migration).

5. **Portfolio positions use `lastPrice` from trade time, not live price.**
   Total equity displayed in `Portfolio.jsx` uses the price at last buy/sell,
   not the current market price. Would require a periodic refresh call to fix.
   Acceptable for paper trading but worth noting.

---

## Phase 4C — completed (2026-05-31)

### What was built
- **Prisma 5** (SQLite for dev) — `backend/prisma/schema.prisma` with `Portfolio`,
  `Position`, `Trade` models. Migration at `backend/prisma/migrations/`.
  Database file: `backend/prisma/dev.db` (gitignored).
- **`portfolioService.js`** — `getOrCreatePortfolio`, `getPortfolioWithPositions`,
  `executeBuy`, `executeSell` (both transactional), `getTrades`, `updateTradeNotes`,
  `getPerformanceStats`, `resetPortfolio`, `serializeTrade` (reconstructs
  `marketContext` object from flat DB columns for the frontend).
- **`routes/portfolio.js`** — `GET /api/portfolio`, `POST /api/portfolio/buy`,
  `POST /api/portfolio/sell`, `GET /api/portfolio/trades`,
  `PATCH /api/portfolio/trades/:id`, `GET /api/portfolio/stats`,
  `POST /api/portfolio/reset`. CORS updated to allow PATCH.
- **`Portfolio.jsx`** — replaced localStorage with API calls; added loading state
  and error banner; optimistic position updates after trade response.
- **`JournalPage.jsx`** — loads trades from API; saves notes via PATCH; stats
  computed client-side from the fetched trade list (same logic as before).
- **`backend/scripts/migrateFromLocalStorage.js`** — one-time import tool.
  Usage: `node scripts/migrateFromLocalStorage.js <export.json>`

### Notes on implementation
- Used **Prisma 5** not 7. Prisma 7 removed `url = env(...)` from schema.prisma
  and requires a driver adapter at runtime — too much overhead for this project.
  Prisma 5 uses the classic `url = env("DATABASE_URL")` pattern.
- `DATABASE_URL="file:./prisma/dev.db"` is set in `.env`. For Railway (Phase 5),
  swap to a PostgreSQL connection string and change `provider` to `postgresql`.
- Trade history tab removed from `Portfolio.jsx` — it's now fully in `JournalPage`.
  The journal is the source of truth; `Portfolio.jsx` shows only positions.
- The `portfolioService.serializeTrade()` helper reconstructs `{ marketContext: {...} }`
  from flat DB columns so `JournalEntry.jsx` sees the same shape as before (no
  frontend component changes needed).

### Data migration (if you have localStorage trades)
1. Open the app in Chrome
2. DevTools → Console → `copy(localStorage.getItem('newbie-trader-portfolio'))`
3. Paste clipboard into `export.json`
4. `node backend/scripts/migrateFromLocalStorage.js export.json`
5. Verify trade count in the Journal page before clearing localStorage

---

## Architectural decisions made (2026-05-30)

### News caching: single route-level cache, not layered
`newsService.getNews()` does not have its own cache. The route handler
caches the full response (articles + Claude summary together) under `news:SYMBOL`
for 15 minutes. A two-layer cache (articles in service + combined in route) would
cause a correctness issue: `?fresh=true` would bypass the route cache but still
return stale articles from the service cache. Single cache at the route boundary
eliminates this edge case.

### Haiku for news summarization, Sonnet for stock analysis
`summarizeNews()` uses `claude-haiku-4-5-20251001` (600 tokens). News runs on
every stock search automatically — it can't be gated behind a button click like
AI Analysis. Haiku keeps cost and latency low for a task that doesn't require
Sonnet's reasoning depth. The main `analyzeStock()` stays on `claude-sonnet-4-5`.

### NewsAPI fallback threshold: < 3 articles
Polygon news is the primary source. NewsAPI is only called if Polygon returns
fewer than 3 results. This avoids a second external API call on the common path
while ensuring the panel always has enough content to be useful.

### Sub-components defined outside parent (React cursor-stability rule)
All components inside `NewsPanel.jsx` that could be naively written as inline
functions (`ArticleCard`, `SentimentBadge`, `NewsSummary`, skeletons) are defined
at module scope. Defining them inside the parent causes React to treat them as
new component types on every re-render, unmounting and remounting them — which
destroys input focus in forms. This pattern is enforced project-wide.

### No dedicated news model / database table
News articles are ephemeral (Polygon owns that data, and they change frequently).
They are intentionally not persisted to the database in Phase 4C. Only the
Claude summary sentiment (bullish/bearish/neutral) could be worth storing at
trade time as part of `marketContext` — but that's a Phase 4C enhancement, not
a requirement.
