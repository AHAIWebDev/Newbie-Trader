import { useState, useEffect } from 'react';

/**
 * Mock Paper Trading Portfolio
 *
 * Stores positions in localStorage so they persist across refreshes.
 * No real money. No brokerage connection. Pure simulation.
 *
 * EDUCATIONAL: This teaches you to think about:
 *   - Cost basis (what you paid)
 *   - Unrealized P&L (gain/loss if you sold now)
 *   - Portfolio allocation (what % is in each position)
 */

const STORAGE_KEY = 'newbie-trader-portfolio';

const defaultPortfolio = {
  cash: 10000.00,   // ← standard paper trading starting balance
  positions: [],
  trades: [],
};

function loadPortfolio() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultPortfolio;
  } catch {
    return defaultPortfolio;
  }
}

function savePortfolio(portfolio) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

export default function Portfolio({ symbol, currentPrice, onCashChange }) {
  const [portfolio, setPortfolio] = useState(loadPortfolio);
  const [shares, setShares]       = useState('');
  const [activeTab, setActiveTab] = useState('positions');
  const [message, setMessage]     = useState('');

  // Persist to localStorage on every change
  useEffect(() => {
    savePortfolio(portfolio);
    onCashChange?.(portfolio.cash);
  }, [portfolio]);

  const totalValue = portfolio.positions.reduce((sum, pos) => {
    return sum + pos.shares * (pos.symbol === symbol && currentPrice ? currentPrice : pos.lastPrice ?? pos.avgCost);
  }, portfolio.cash);

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError });
    setTimeout(() => setMessage(''), 3000);
  };

  const buyStock = () => {
    const qty = parseInt(shares);
    if (!qty || qty <= 0) return showMessage('Enter a valid number of shares', true);
    if (!currentPrice) return showMessage('No price available', true);

    const cost = qty * currentPrice;
    if (cost > portfolio.cash) {
      return showMessage(`Not enough cash. Need $${cost.toFixed(2)}, have $${portfolio.cash.toFixed(2)}`, true);
    }

    setPortfolio(prev => {
      const existingIdx = prev.positions.findIndex(p => p.symbol === symbol);
      let newPositions;

      if (existingIdx >= 0) {
        // Average down/up: recalculate cost basis
        const existing = prev.positions[existingIdx];
        const totalShares = existing.shares + qty;
        const avgCost = (existing.shares * existing.avgCost + qty * currentPrice) / totalShares;
        newPositions = [...prev.positions];
        newPositions[existingIdx] = { ...existing, shares: totalShares, avgCost: parseFloat(avgCost.toFixed(4)) };
      } else {
        newPositions = [...prev.positions, {
          symbol,
          shares: qty,
          avgCost: currentPrice,
          lastPrice: currentPrice,
          addedAt: new Date().toISOString(),
        }];
      }

      const trade = {
        id: Date.now(),
        type: 'BUY',
        symbol,
        shares: qty,
        price: currentPrice,
        total: cost,
        date: new Date().toISOString(),
      };

      return {
        cash: parseFloat((prev.cash - cost).toFixed(2)),
        positions: newPositions,
        trades: [trade, ...prev.trades],
      };
    });

    setShares('');
    showMessage(`✓ Bought ${qty} shares of ${symbol} at $${currentPrice.toFixed(2)}`);
  };

  const sellStock = () => {
    const qty = parseInt(shares);
    if (!qty || qty <= 0) return showMessage('Enter a valid number of shares', true);

    const position = portfolio.positions.find(p => p.symbol === symbol);
    if (!position) return showMessage(`You don't own any ${symbol}`, true);
    if (qty > position.shares) return showMessage(`You only own ${position.shares} shares`, true);

    const proceeds = qty * (currentPrice ?? position.avgCost);
    const pnl = (currentPrice - position.avgCost) * qty;

    setPortfolio(prev => {
      const existingIdx = prev.positions.findIndex(p => p.symbol === symbol);
      let newPositions;

      if (qty === position.shares) {
        newPositions = prev.positions.filter(p => p.symbol !== symbol);
      } else {
        newPositions = [...prev.positions];
        newPositions[existingIdx] = { ...position, shares: position.shares - qty };
      }

      const trade = {
        id: Date.now(),
        type: 'SELL',
        symbol,
        shares: qty,
        price: currentPrice,
        total: proceeds,
        pnl: parseFloat(pnl.toFixed(2)),
        date: new Date().toISOString(),
      };

      return {
        cash: parseFloat((prev.cash + proceeds).toFixed(2)),
        positions: newPositions,
        trades: [trade, ...prev.trades],
      };
    });

    setShares('');
    const sign = pnl >= 0 ? '+' : '';
    showMessage(`✓ Sold ${qty} shares of ${symbol}. P&L: ${sign}$${pnl.toFixed(2)}`);
  };

  const resetPortfolio = () => {
    if (window.confirm('Reset portfolio to $10,000 cash? This clears all positions and trade history.')) {
      setPortfolio(defaultPortfolio);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-300 font-semibold">Paper Portfolio</h2>
        <button onClick={resetPortfolio} className="text-xs text-slate-600 hover:text-slate-400">
          Reset
        </button>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Cash Available</div>
          <div className="font-mono text-xl font-bold text-white">${portfolio.cash.toFixed(2)}</div>
        </div>
        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Portfolio Value</div>
          <div className="font-mono text-xl font-bold text-white">${totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Buy/Sell controls — only when viewing a stock */}
      {symbol && currentPrice && (
        <div className="mb-5 p-3 bg-slate-800 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-500 mb-2">
            Trade {symbol} @ ${currentPrice.toFixed(2)}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={shares}
              onChange={e => setShares(e.target.value)}
              placeholder="Shares"
              min="1"
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2
                         text-slate-100 font-mono text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={buyStock}
              className="px-4 py-2 bg-green-800 hover:bg-green-700 text-bull
                         font-semibold text-sm rounded transition-colors"
            >
              Buy
            </button>
            <button
              onClick={sellStock}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-bear
                         font-semibold text-sm rounded transition-colors"
            >
              Sell
            </button>
          </div>
          {message && (
            <p className={`text-xs mt-2 ${message.isError ? 'text-bear' : 'text-bull'}`}>
              {message.text}
            </p>
          )}
        </div>
      )}

      {/* Tabs: Positions / Trade History */}
      <div className="flex border-b border-slate-700 mb-3">
        {['positions', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize transition-colors
              ${activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-500 hover:text-slate-400'}`}
          >
            {tab === 'positions'
              ? `Positions (${portfolio.positions.length})`
              : `History (${portfolio.trades.length})`}
          </button>
        ))}
      </div>

      {/* Positions tab */}
      {activeTab === 'positions' && (
        portfolio.positions.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-6">
            No open positions. Search a stock and make a paper trade above.
          </p>
        ) : (
          <div className="space-y-2">
            {portfolio.positions.map(pos => {
              const price = pos.symbol === symbol && currentPrice ? currentPrice : pos.avgCost;
              const pnl = (price - pos.avgCost) * pos.shares;
              const pnlPct = ((price - pos.avgCost) / pos.avgCost * 100).toFixed(2);
              const isPos = pnl >= 0;
              return (
                <div key={pos.symbol} className="flex justify-between items-center
                                                   p-3 bg-slate-800 rounded-lg text-sm">
                  <div>
                    <div className="font-mono font-bold text-white">{pos.symbol}</div>
                    <div className="text-slate-500 text-xs">
                      {pos.shares} shares @ ${pos.avgCost.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-semibold ${isPos ? 'text-bull' : 'text-bear'}`}>
                      {isPos ? '+' : ''}${pnl.toFixed(2)}
                    </div>
                    <div className={`text-xs ${isPos ? 'text-bull' : 'text-bear'}`}>
                      {isPos ? '+' : ''}{pnlPct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        portfolio.trades.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-6">No trades yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {portfolio.trades.map(trade => (
              <div key={trade.id} className="flex justify-between items-center
                                               p-3 bg-slate-800 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${trade.type === 'BUY' ? 'text-bull' : 'text-bear'}`}>
                    {trade.type}
                  </span>
                  <span className="font-mono text-white">{trade.symbol}</span>
                  <span className="text-slate-500">{trade.shares} × ${trade.price.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-slate-300">${trade.total.toFixed(2)}</div>
                  {trade.pnl !== undefined && (
                    <div className={trade.pnl >= 0 ? 'text-bull' : 'text-bear'}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </div>
                  )}
                  <div className="text-slate-600">
                    {new Date(trade.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}