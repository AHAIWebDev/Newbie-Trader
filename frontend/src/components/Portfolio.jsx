import { useState, useEffect, useCallback } from 'react';
import TradeModal from './TradeModal';
import { getPortfolio, executeBuy, executeSell, resetPortfolio } from '../api/stockApi';

export default function Portfolio({
  symbol,
  currentPrice,
  indicators,
  currentAnalysis,
  onCashChange,
}) {
  const [portfolio,    setPortfolio]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [shares,       setShares]       = useState('');
  const [activeTab,    setActiveTab]    = useState('positions');
  const [pendingTrade, setPendingTrade] = useState(null);
  const [tradeError,   setTradeError]   = useState(null);

  // ─── Load portfolio from API ───────────────────────────────────────────────

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await getPortfolio();
      setPortfolio(data);
    } catch {
      // If the API is unreachable on first load, show empty state rather than crash
      setPortfolio({ cash: 0, startingCash: 10000, positions: [], trades: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  // Propagate totalEquity (cash + market value of all positions) to parent
  // whenever portfolio state or the current price/symbol changes.
  useEffect(() => {
    if (!portfolio) return;
    const equity = portfolio.positions.reduce((sum, pos) => {
      const price = pos.symbol === symbol && currentPrice
        ? currentPrice
        : pos.lastPrice ?? pos.avgCost;
      return sum + pos.shares * price;
    }, portfolio.cash);
    onCashChange?.(equity);
  }, [portfolio, currentPrice, symbol]);

  // ─── Derived values ────────────────────────────────────────────────────────

  const positions   = portfolio?.positions ?? [];
  const cash        = portfolio?.cash        ?? 0;
  const startingCash = portfolio?.startingCash ?? 10000;

  const totalEquity = positions.reduce((sum, pos) => {
    const price = pos.symbol === symbol && currentPrice ? currentPrice : pos.avgCost;
    return sum + pos.shares * price;
  }, cash);

  const totalReturn    = totalEquity - startingCash;
  const totalReturnPct = ((totalReturn / startingCash) * 100).toFixed(2);

  // ─── Initiate trades (opens modal) ────────────────────────────────────────

  const initiateBuy = () => {
    const qty = parseInt(shares);
    if (!qty || qty <= 0 || !currentPrice) return;

    const cost = qty * currentPrice;
    if (cost > cash) {
      alert(`Not enough cash. Need $${cost.toFixed(2)}, have $${cash.toFixed(2)}`);
      return;
    }

    setTradeError(null);
    setPendingTrade({ type: 'BUY', symbol, shares: qty, price: currentPrice, total: cost });
  };

  const initiateSell = () => {
    const qty      = parseInt(shares);
    const position = positions.find(p => p.symbol === symbol);

    if (!qty || qty <= 0) return;
    if (!position) { alert(`You don't own any ${symbol}`); return; }
    if (qty > position.shares) {
      alert(`You only own ${position.shares} shares of ${symbol}`);
      return;
    }

    const price    = currentPrice ?? position.avgCost;
    const proceeds = qty * price;
    const pnl      = (price - position.avgCost) * qty;

    setTradeError(null);
    setPendingTrade({
      type:   'SELL',
      symbol,
      shares: qty,
      price,
      total:  proceeds,
      pnl:    parseFloat(pnl.toFixed(2)),
      pnlPct: parseFloat(((price - position.avgCost) / position.avgCost * 100).toFixed(2)),
    });
  };

  // ─── Execute confirmed trade ───────────────────────────────────────────────

  const executeConfirmedTrade = async ({ reasoning, marketContext }) => {
    const trade = pendingTrade;
    setPendingTrade(null);
    setShares('');

    try {
      if (trade.type === 'BUY') {
        const result = await executeBuy({
          symbol:        trade.symbol,
          shares:        trade.shares,
          price:         trade.price,
          total:         trade.total,
          reasoning,
          marketContext,
        });
        setPortfolio(prev => ({
          ...prev,
          cash:      result.cash,
          positions: upsertPosition(prev.positions, trade, trade.price),
        }));
      } else {
        const result = await executeSell({
          symbol:        trade.symbol,
          shares:        trade.shares,
          price:         trade.price,
          total:         trade.total,
          pnl:           trade.pnl,
          pnlPct:        trade.pnlPct,
          reasoning,
          marketContext,
        });
        setPortfolio(prev => ({
          ...prev,
          cash:      result.cash,
          positions: removeOrReducePosition(prev.positions, trade),
        }));
      }
    } catch (err) {
      setTradeError(err.response?.data?.error ?? 'Trade failed. Please try again.');
    }
  };

  const handleReset = async () => {
    const input  = window.prompt('Reset portfolio? Enter starting cash (e.g. 10000):', '10000');
    if (input === null) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const updated = await resetPortfolio(amount);
      setPortfolio({ ...updated, positions: [] });
    } catch {
      alert('Reset failed. Please try again.');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <div className="text-slate-500 text-sm">Loading portfolio…</div>
      </div>
    );
  }

  return (
    <>
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
            onClick={handleReset}
            className="text-xs text-slate-600 hover:text-slate-400"
          >
            Reset
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-800 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Cash Available</div>
            <div className="font-mono text-lg font-bold text-white">
              ${cash.toFixed(2)}
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
                          ${totalReturn >= 0
                            ? 'bg-green-950/50 card-glow-bull'
                            : 'bg-red-950/50 card-glow-bear'}`}>
          <span className="text-slate-400 text-xs">Total Return: </span>
          <span className={`font-mono font-bold
                             ${totalReturn >= 0 ? 'text-bull' : 'text-bear'}`}>
            {totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}
            {' '}({totalReturn >= 0 ? '+' : ''}{totalReturnPct}%)
          </span>
        </div>

        {/* Trade error banner */}
        {tradeError && (
          <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-300">
            {tradeError}
            <button onClick={() => setTradeError(null)} className="ml-2 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Buy/Sell controls */}
        {symbol && currentPrice && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-500 mb-2">
              {symbol} @ <span className="font-mono text-white">
                ${currentPrice.toFixed(2)}
              </span>
              <span className="ml-2 text-slate-600">
                (You own: {positions.find(p => p.symbol === symbol)?.shares ?? 0} shares)
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
            { key: 'positions', label: `Positions (${positions.length})` },
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
        {positions.length === 0
          ? <p className="text-slate-600 text-sm text-center py-6">
              No open positions. Search a stock and make a paper trade.
            </p>
          : <div className="space-y-2">
              {positions.map(pos => {
                const price  = pos.symbol === symbol && currentPrice ? currentPrice : pos.avgCost;
                const pnl    = (price - pos.avgCost) * pos.shares;
                const pnlPct = ((price - pos.avgCost) / pos.avgCost * 100).toFixed(2);
                const isPos  = pnl >= 0;

                return (
                  <div key={pos.symbol}
                       className="flex justify-between items-center p-3
                                  bg-slate-800 rounded-lg text-sm">
                    <div>
                      <div className="font-mono font-bold text-white">{pos.symbol}</div>
                      <div className="text-slate-500 text-xs">
                        {pos.shares} shares · avg ${pos.avgCost.toFixed(2)}
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
        }
      </div>
    </>
  );
}

// ─── Position helpers (optimistic local update) ────────────────────────────────

function upsertPosition(positions, trade, price) {
  const idx = positions.findIndex(p => p.symbol === trade.symbol);
  if (idx >= 0) {
    const existing    = positions[idx];
    const totalShares = existing.shares + trade.shares;
    const avgCost     = (existing.shares * existing.avgCost + trade.shares * price) / totalShares;
    const updated     = [...positions];
    updated[idx]      = { ...existing, shares: totalShares, avgCost: parseFloat(avgCost.toFixed(4)) };
    return updated;
  }
  return [...positions, {
    symbol: trade.symbol, shares: trade.shares,
    avgCost: price, lastPrice: price, addedAt: new Date().toISOString(),
  }];
}

function removeOrReducePosition(positions, trade) {
  const idx = positions.findIndex(p => p.symbol === trade.symbol);
  if (idx < 0) return positions;
  const remaining = positions[idx].shares - trade.shares;
  if (remaining <= 0) return positions.filter(p => p.symbol !== trade.symbol);
  const updated = [...positions];
  updated[idx]  = { ...updated[idx], shares: remaining };
  return updated;
}
