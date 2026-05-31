import { useState, useEffect } from 'react';
import JournalEntry from '../components/JournalEntry';
import { getTrades, updateTradeNotes } from '../api/stockApi';

export default function JournalPage() {
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    getTrades()
      .then(setTrades)
      .catch(() => setError('Could not load trades. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateNotes = async (tradeId, notes) => {
    try {
      await updateTradeNotes(tradeId, notes);
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, outcomeNotes: notes } : t));
    } catch {
      alert('Failed to save notes. Please try again.');
    }
  };

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const sells      = trades.filter(t => t.type === 'SELL' && t.pnl != null);
  const wins       = sells.filter(t => t.pnl > 0);
  const losses     = sells.filter(t => t.pnl < 0);
  const totalPnl   = sells.reduce((sum, t) => sum + t.pnl, 0);
  const winRate    = sells.length > 0 ? ((wins.length / sells.length) * 100).toFixed(0) : null;
  const avgWin     = wins.length   > 0 ? wins.reduce((s, t)   => s + t.pnl, 0) / wins.length   : null;
  const avgLoss    = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : null;
  const bestTrade  = sells.reduce((b, t) => (!b || t.pnl > b.pnl ? t : b), null);
  const worstTrade = sells.reduce((w, t) => (!w || t.pnl < w.pnl ? t : w), null);

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filtered = trades.filter(t => {
    if (search && !t.symbol.includes(search.toUpperCase())) return false;
    if (filter === 'buy')  return t.type === 'BUY';
    if (filter === 'sell') return t.type === 'SELL';
    if (filter === 'win')  return t.pnl > 0;
    if (filter === 'loss') return t.pnl < 0;
    return true;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-200">Trade Journal</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every trade you've made, with your reasoning and market conditions captured at execution time.
        </p>
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-500">Loading trades…</div>
      )}

      {error && (
        <div className="p-5 bg-red-950 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Performance stats */}
          {trades.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: 'Total Trades',
                  value: trades.length,
                  sub:   `${sells.length} closed`,
                },
                {
                  label: 'Win Rate',
                  value: winRate != null ? `${winRate}%` : '—',
                  sub:   `${wins.length}W / ${losses.length}L`,
                  color: winRate >= 50 ? 'text-bull' : 'text-bear',
                },
                {
                  label: 'Total P&L',
                  value: sells.length > 0
                    ? `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`
                    : '—',
                  color: totalPnl >= 0 ? 'text-bull' : 'text-bear',
                  sub:   'realized only',
                },
                {
                  label: 'Avg Win / Avg Loss',
                  value: avgWin != null
                    ? `$${avgWin.toFixed(0)} / $${Math.abs(avgLoss ?? 0).toFixed(0)}`
                    : '—',
                  sub: avgWin && avgLoss
                    ? `ratio: ${(avgWin / Math.abs(avgLoss)).toFixed(2)}x`
                    : 'no closed trades',
                },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="card text-center">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className={`font-mono text-xl font-bold ${color ?? 'text-white'}`}>
                    {value}
                  </div>
                  {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Best/worst trades */}
          {(bestTrade || worstTrade) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {bestTrade && (
                <div className="card border-green-900">
                  <div className="text-xs text-slate-500 mb-1">🏆 Best Trade</div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-white">{bestTrade.symbol}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {new Date(bestTrade.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-bull">
                      +${bestTrade.pnl.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs mt-1 line-clamp-1 italic">
                    "{bestTrade.reasoning}"
                  </p>
                </div>
              )}
              {worstTrade && (
                <div className="card border-red-900">
                  <div className="text-xs text-slate-500 mb-1">📉 Worst Trade</div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-white">{worstTrade.symbol}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {new Date(worstTrade.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-bear">
                      ${worstTrade.pnl.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs mt-1 line-clamp-1 italic">
                    "{worstTrade.reasoning}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Filter bar */}
          {trades.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by symbol..."
                className="bg-slate-800 border border-slate-700 rounded-lg
                           px-3 py-1.5 text-slate-200 text-sm font-mono
                           focus:outline-none focus:border-blue-500 w-40"
              />
              <div className="flex gap-1">
                {[
                  { key: 'all',  label: 'All'       },
                  { key: 'buy',  label: 'Buys'      },
                  { key: 'sell', label: 'Sells'     },
                  { key: 'win',  label: '✓ Wins'   },
                  { key: 'loss', label: '✗ Losses' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors
                      ${filter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-slate-600 text-xs ml-auto">
                {filtered.length} of {trades.length} trades
              </span>
            </div>
          )}

          {/* Trade list */}
          {trades.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">📓</div>
              <h2 className="text-xl font-semibold text-slate-400 mb-2">No trades yet</h2>
              <p className="text-slate-600 max-w-sm mx-auto">
                Every paper trade you make will appear here with your reasoning,
                market conditions, and P&amp;L so you can review your decisions over time.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              No trades match the current filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(trade => (
                <JournalEntry
                  key={trade.id}
                  trade={trade}
                  onUpdateNotes={handleUpdateNotes}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
