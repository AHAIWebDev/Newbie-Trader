import { useState }       from 'react';
import { getStock }       from '../api/stockApi';
import SearchBar          from '../components/SearchBar';
import StockHeader        from '../components/StockHeader';
import PriceChart         from '../components/PriceChart';
import IndicatorPanel     from '../components/IndicatorPanel';
import AnalysisCard       from '../components/AnalysisCard';
import PositionSizer      from '../components/PositionSizer';
import Portfolio          from '../components/Portfolio';
import NewsPanel          from '../components/NewsPanel';

export default function StockPage() {
  const [stock,          setStock]          = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [portfolioValue, setPortfolioValue] = useState(10000);

  /**
   * Lifted from AnalysisCard — stores Claude's result so the
   * trade modal can snapshot AI confidence at trade time.
   */
  const [currentAnalysis, setCurrentAnalysis] = useState(null);

  const handleSearch = async (symbol) => {
    setLoading(true);
    setError(null);
    setStock(null);
    setCurrentAnalysis(null);

    try {
      const data = await getStock(symbol);
      setStock(data);
    } catch (err) {
      setError(
        err.response?.data?.error ??
        `Could not load data for ${symbol}. Check the symbol and try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">

      {/* Search bar row */}
      <div className="mb-6 max-w-2xl">
        <SearchBar onSearch={handleSearch} isLoading={loading} />
      </div>

      {/* Landing state */}
      {!stock && !loading && !error && (
        <div className="text-center py-24 relative">
          {/* Decorative glow orbs */}
          <div className="absolute top-10 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-20 right-1/4 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]">📈</div>
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
              Welcome to Newbie Trader
            </h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
              Search any stock symbol to view price data, technical indicators,
              and an AI-powered educational analysis. Make paper trades and
              log your reasoning in the journal.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'SPY', 'AMD', 'NVDA'].map(s => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="px-4 py-2 rounded-lg font-mono text-sm
                             bg-slate-800/60 backdrop-blur-sm
                             border border-slate-700/60
                             text-slate-300 hover:text-white
                             hover:border-blue-500/50
                             hover:bg-slate-700/60
                             hover:shadow-[0_0_12px_rgba(96,165,250,0.2)]
                             transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="max-w-lg mx-auto mt-12 p-5 bg-red-950
                        border border-red-800 rounded-xl">
          <h3 className="text-red-400 font-semibold mb-1">Could not load stock</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loaded stock */}
      {stock && (
        <div className="space-y-5">

          <StockHeader stock={stock} />

          {/* Chart + Portfolio */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <PriceChart
                bars={stock.historicalBars}
                sma20={stock.indicators.sma20}
                sma50={stock.indicators.sma50}
              />
            </div>
            <Portfolio
              symbol={stock.symbol}
              currentPrice={stock.price.close}
              indicators={stock.indicators}
              currentAnalysis={currentAnalysis}
              onCashChange={setPortfolioValue}
            />
          </div>

          {/* Indicators + Position Sizer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <IndicatorPanel indicators={stock.indicators} />
            <PositionSizer
              symbol={stock.symbol}
              currentPrice={stock.price.close}
              portfolioValue={portfolioValue}
            />
          </div>

          {/* AI Analysis — full width */}
          <AnalysisCard
            symbol={stock.symbol}
            onAnalysisComplete={setCurrentAnalysis}
          />

          {/* News panel — auto-fetches on stock load */}
          <NewsPanel symbol={stock.symbol} />

        </div>
      )}
    </main>
  );
}