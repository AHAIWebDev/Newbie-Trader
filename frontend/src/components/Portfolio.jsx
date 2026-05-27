import { useState, useEffect } from 'react';
import TradeModal from './TradeModal';

const STORAGE_KEY = 'newbie-trader-portfolio';

const defaultPortfolio = {
  cash:         10000.00,
  startingCash: 10000.00,
  positions:    [],
  trades:       [],
};

function loadPortfolio() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultPortfolio;
  } catch {
    return defaultPortfolio;
  }
}

function savePortfolio(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export default function Portfolio({
  symbol,
  currentPrice,
  indicators,
  currentAnalysis,
  onCashChange,
}) {
  const [portfolio, setPortfolio] = useState(loadPortfolio);
  const [shares,    setShares]    = useState('');
  const [activeTab, setActiveTab] = useState('positions');

  /**
   * pendingTrade holds the trade waiting for modal confirmation.
   * Shape: { type, symbol, shares, price, total, pnl? }
   */
  const [pendingTrade, setPendingTrade] = useState(null);

  // Persist + notify parent of cash changes
  useEffect(() => {
    savePortfolio(portfolio);
    onCashChange?.(portfolio.cash);
  }, [portfolio]);

  // Total equity = cash + market value of all positions
  const totalEquity = portfolio.positions.reduce((sum, pos) => {
    const price = pos.symbol === symbol && currentPrice
      ? currentPrice
      : pos.lastPrice ?? pos.avgCost;
    return sum + pos.shares * price;
  }, portfolio.cash);

  const totalReturn     = totalEquity - portfolio.startingCash;
  const totalReturnPct  = ((totalReturn / portfolio.startingCash) * 100).toFixed(2);

  // ─── Initiate trades (opens modal) ────────────────────────────────────────

  const initiateBuy = () => {
    const qty = parseInt(shares);
    if (!qty || qty <= 0) return;
    if (!currentPrice)   return;

    const cost = qty * currentPrice;
    if (cost > portfolio.cash) {
      alert(`Not enough cash. Need $${cost.toFixed(2)}, have $${portfolio.cash.toFixed(2)}`);
      return;
    }

    setPendingTrade({
      type:   'BUY',
      symbol,
      shares: qty,
      price:  currentPrice,
      total:  cost,
    });
  };

  const initiateSell = () => {
    const qty      = parseInt(shares);
    const position = portfolio.positions.find(p => p.symbol === symbol);

    if (!qty || qty <= 0) return;
    if (!position) {
      alert(`You don't own any ${symbol}`);
      return;
    }
    if (qty > position.shares) {
      alert(`You only own ${position.shares} shares of ${symbol}`);
      return;
    }

    const price   = currentPrice ?? position.avgCost;
    const proceeds = qty * price;
    const pnl      = (price - position.avgCost) * qty;

    setPendingTrade({
      type:    'SELL',
      symbol,
      shares:  qty,
      price,
      total:   proceeds,
      pnl:     parseFloat(pnl.toFixed(2)),
      pnlPct:  parseFloat(((price - position.avgCost) / position.avgCost * 100).toFixed(2)),
    });
  };

  // ─── Execute confirmed trade ───────────────────────────────────────────────

  const executeConfirmedTrade = ({ reasoning, marketContext }) => {
    const trade = pendingTrade;
    setPendingTrade(null);
    setShares('');

    const journalEntry = {
      id:            Date.now(),
      type:          trade.type,
      symbol:        trade.symbol,
      shares:        trade.shares,
      price:         trade.price,
      total:         trade.total,
      date:          new Date().toISOString(),
      // Journal data captured at time of trade
      reasoning,
      marketContext,
      pnl:           trade.pnl     ?? null,
      pnlPct:        trade.pnlPct  ?? null,
      // Post-trade reflection — filled in later via journal
      outcomeNotes:  '',
    };

    setPortfolio(prev => {
      if (trade.type === 'BUY') {
        const existingIdx = prev.positions.findIndex(p => p.symbol === trade.symbol);
        let newPositions;

        if (existingIdx >= 0) {
          const existing    = prev.positions[existingIdx];
          const totalShares = existing.shares + trade.shares;
          const avgCost     = (
            existing.shares * existing.avgCost +
            trade.shares    * trade.price
          ) / totalShares;

          newPositions = [...prev.positions];
          newPositions[existingIdx] = {
            ...existing,
            shares:  totalShares,
            avgCost: parseFloat(avgCost.toFixed(4)),
          };
        } else {
          newPositions = [...prev.positions, {
            symbol:    trade.symbol,
            shares:    trade.shares,
            avgCost:   trade.price,
            lastPrice: trade.price,
            addedAt:   new Date().toISOString(),
          }];
        }

        return {
          ...prev,
          cash:      parseFloat((prev.cash - trade.total).toFixed(2)),
          positions: newPositions,
          trades:    [journalEntry, ...prev.trades],
        };

      } else {
        // SELL
        const existingIdx = prev.positions.findIndex(p => p.symbol === trade.symbol);
        let newPositions;

        if (trade.shares === prev.positions[existingIdx]?.shares) {
          newPositions = prev.positions.filter(p => p.symbol !== trade.symbol);
        } else {
          newPositions = [...prev.positions];
          newPositions[existingIdx] = {
            ...newPositions[existingIdx],
            shares: newPositions[existingIdx].shares - trade.shares,
          };
        }

        return {
          ...prev,
          cash:      parseFloat((prev.cash + trade.total).toFixed(2)),
          positions: newPositions,
          trades:    [journalEntry, ...prev.trades],
        };
      }
    });
  };

  const resetPortfolio = () => {
    const input  = window.prompt(
      'Reset portfolio? Enter starting cash (e.g. 10000):',
      '10000'
    );
    if (input === null) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) return;

    setPortfolio({
      cash:         amount,
      startingCash: amount,
      positions:    [],
      trades:       [],
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trade confirmation modal */}
      {pendingTrade && (
        <TradeModal
          trade={pendingTrade}
          indicators={indicators}
          currentAnalysis={currentAnalysis}
          onConfirm={executeConfirmedTrade}
          onCancel={() => setPendingTrade(null)}
        />
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-300 font-semibold">Paper Portfolio</h2>
          <button
            onClick={resetPortfolio}
            className="text-xs text-slate-600 hover:text-slate-400"
          >
            Reset
          </button>
        </div>

        {/* Portfolio summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-800 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Cash Available</div>
            <div className="font-mono text-lg font-bold text-white">
              ${portfolio.cash.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-slate-800 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Total Equity</div>
            <div className="font-mono text-lg font-bold text-white">
              ${totalEquity.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Total return */}
        <div className={`p-2.5 rounded-lg mb-4 text-center text-sm
                          ${totalReturn >= 0 ? 'bg-green-950' : 'bg-red-950'}`}>
          <span className="text-slate-400 text-xs">Total Return: </span>
          <span className={`font-mono font-bold
                             ${totalReturn >= 0 ? 'text-bull' : 'text-bear'}`}>
            {totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}
            {' '}({totalReturn >= 0 ? '+' : ''}{totalReturnPct}%)
          </span>
        </div>

        {/* Buy/Sell controls */}
        {symbol && currentPrice && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-500 mb-2">
              {symbol} @ <span className="font-mono text-white">
                ${currentPrice.toFixed(2)}
              </span>
              <span className="ml-2 text-slate-600">
                (You own: {portfolio.positions.find(p => p.symbol === symbol)?.shares ?? 0} shares)
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder="Shares"
                min="1"
                className="flex-1 bg-slate-700 border border-slate-600 rounded
                           px-3 py-2 text-slate-100 font-mono text-sm
                           focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={initiateBuy}
                disabled={!shares || parseInt(shares) <= 0}
                className="px-4 py-2 bg-green-900 hover:bg-green-800
                           disabled:opacity-40 text-bull font-semibold
                           text-sm rounded transition-colors"
              >
                Buy
              </button>
              <button
                onClick={initiateSell}
                disabled={!shares || parseInt(shares) <= 0}
                className="px-4 py-2 bg-red-950 hover:bg-red-900
                           disabled:opacity-40 text-bear font-semibold
                           text-sm rounded transition-colors"
              >
                Sell
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-700 mb-3">
          {[
            { key: 'positions', label: `Positions (${portfolio.positions.length})` },
            { key: 'history',   label: `History (${portfolio.trades.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm transition-colors
                ${activeTab === key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-500 hover:text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Positions */}
        {activeTab === 'positions' && (
          portfolio.positions.length === 0
            ? <p className="text-slate-600 text-sm text-center py-6">
                No open positions. Search a stock and make a paper trade.
              </p>
            : <div className="space-y-2">
                {portfolio.positions.map(pos => {
                  const price   = pos.symbol === symbol && currentPrice
                    ? currentPrice : pos.avgCost;
                  const pnl     = (price - pos.avgCost) * pos.shares;
                  const pnlPct  = ((price - pos.avgCost) / pos.avgCost * 100).toFixed(2);
                  const isPos   = pnl >= 0;

                  return (
                    <div key={pos.symbol}
                         className="flex justify-between items-center p-3
                                    bg-slate-800 rounded-lg text-sm">
                      <div>
                        <div className="font-mono font-bold text-white">
                          {pos.symbol}
                        </div>
                        <div className="text-slate-500 text-xs">
                          {pos.shares} shares · avg ${pos.avgCost.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono font-semibold
                                          ${isPos ? 'text-bull' : 'text-bear'}`}>
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
        )}

        {/* Trade history (compact) */}
        {activeTab === 'history' && (
          portfolio.trades.length === 0
            ? <p className="text-slate-600 text-sm text-center py-6">
                No trades yet.
              </p>
            : <div className="space-y-2 max-h-56 overflow-y-auto">
                {portfolio.trades.map(trade => (
                  <div key={trade.id}
                       className="p-3 bg-slate-800 rounded-lg text-xs">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold
                          ${trade.type === 'BUY' ? 'text-bull' : 'text-bear'}`}>
                          {trade.type}
                        </span>
                        <span className="font-mono text-white">{trade.symbol}</span>
                        <span className="text-slate-500">
                          {trade.shares} × ${trade.price.toFixed(2)}
                        </span>
                      </div>
                      {trade.pnl != null && (
                        <span className={`font-mono font-bold
                          ${trade.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {/* Show reasoning preview */}
                    {trade.reasoning && (
                      <p className="text-slate-600 mt-1.5 line-clamp-1 italic">
                        "{trade.reasoning}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
        )}
      </div>
    </>
  );
}