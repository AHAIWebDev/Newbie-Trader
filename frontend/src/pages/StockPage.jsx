import { useState } from 'react';
import { getStock } from '../api/stockApi';
import SearchBar       from '../components/SearchBar';
import StockHeader     from '../components/StockHeader';
import PriceChart      from '../components/PriceChart';
import IndicatorPanel  from '../components/IndicatorPanel';
import AnalysisCard    from '../components/AnalysisCard';
import PositionSizer   from '../components/PositionSizer';
import Portfolio       from '../components/Portfolio';

/**
 * Main stock analysis page.
 * Orchestrates all components around a searched symbol.
 */
export default function StockPage() {
  const [stock,   setStock]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [portfolioCash, setPortfolioCash] = useState(10000);

  const handleSearch = async (symbol) => {
    setLoading(true);
    setError(null);
    setStock(null);

    try {
      const data = await getStock(symbol);
      setStock(data);
    } catch (err) {
      const msg = err.response?.data?.error
        ?? err.response?.data?.hint
        ?? `Could not load data for ${symbol}. Check the symbol and try again.`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Top nav */}
      <header className="border-b border-slate-800 bg-surface/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <span className="font-mono font-bold text-blue-400 text-lg">📈 Newbie Trader</span>
            <span className="ml-2 text-xs text-slate-600 hidden sm:inline">
              Paper trading · Educational only
            </span>
          </div>
          <div className="flex-1 max-w-xl">
            <SearchBar onSearch={handleSearch} isLoading={loading} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Initial landing state */}
        {!stock && !loading && !error && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-slate-300 mb-2">Welcome to Newbie Trader</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Search for any stock symbol to view price data, technical indicators,
              and an AI-powered educational analysis.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'SPY'].map(s => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700
                             text-slate-300 font-mono text-sm rounded-lg transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="max-w-lg mx-auto mt-12 p-5 bg-red-950 border border-red-800 rounded-xl">
            <h3 className="text-red-400 font-semibold mb-1">Could not load stock data</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Loaded stock view */}
        {stock && (
          <div className="space-y-5">

            {/* Row 1: Header spans full width */}
            <StockHeader stock={stock} />

            {/* Row 2: Chart (left, larger) + Portfolio (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <PriceChart
                  bars={stock.historicalBars}
                  sma20={stock.indicators.sma20}
                  sma50={stock.indicators.sma50}
                />
              </div>
              <div>
                <Portfolio
                  symbol={stock.symbol}
                  currentPrice={stock.price.close}
                  onCashChange={setPortfolioCash}
                />
              </div>
            </div>

            {/* Row 3: Indicators (left) + Position Sizer (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <IndicatorPanel indicators={stock.indicators} />
              <PositionSizer
                symbol={stock.symbol}
                currentPrice={stock.price.close}
                portfolioCash={portfolioCash}
              />
            </div>

            {/* Row 4: AI Analysis — full width */}
            <AnalysisCard symbol={stock.symbol} />

          </div>
        )}
      </main>
    </div>
  );
}