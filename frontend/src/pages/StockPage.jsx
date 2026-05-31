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
  const [portfolioCash,  setPortfolioCash]  = useState(10000);

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
        <div className="text-center py-24">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-slate-300 mb-2">
            Search a stock to get started
          </h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            View price data, technical indicators, and an AI-powered educational
            analysis. Make paper trades and log your reasoning in the journal.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'SPY', 'AMD', 'NVDA'].map(s => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border
                           border-slate-700 text-slate-300 font-mono text-sm
                           rounded-lg transition-colors"
              >
                {s}
              </button>
            ))}
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
              onCashChange={setPortfolioCash}
            />
          </div>

          {/* Indicators + Position Sizer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <IndicatorPanel indicators={stock.indicators} />
            <PositionSizer
              symbol={stock.symbol}
              currentPrice={stock.price.close}
              portfolioCash={portfolioCash}
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