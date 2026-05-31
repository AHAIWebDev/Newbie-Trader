import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { getEquityHistory, getSignalAccuracy, getPortfolioStats } from '../api/stockApi';

// ─── Equity chart tooltip ──────────────────────────────────────────────────────

function EquityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const date = new Date(d.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm">
      <div className="text-slate-400 text-xs mb-1">{date}</div>
      <div className="font-mono font-bold text-white">${d.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      {d.event !== 'start' && (
        <div className={`text-xs mt-1 font-semibold ${d.event === 'BUY' ? 'text-bull' : 'text-bear'}`}>
          {d.label}
        </div>
      )}
    </div>
  );
}

// ─── Signal table ──────────────────────────────────────────────────────────────

const RSI_META = {
  overbought: { label: 'Overbought (>70)', color: 'text-yellow-400' },
  oversold:   { label: 'Oversold (<30)',   color: 'text-blue-400'   },
  bullish:    { label: 'Bullish',          color: 'text-bull'       },
  bearish:    { label: 'Bearish',          color: 'text-bear'       },
  neutral:    { label: 'Neutral',          color: 'text-slate-400'  },
  unknown:    { label: 'Not recorded',     color: 'text-slate-600'  },
};

const SMA_META = {
  'Both Bullish': { color: 'text-bull'  },
  'Both Bearish': { color: 'text-bear'  },
  'Mixed':        { color: 'text-slate-400' },
};

function winRateColor(rate) {
  if (rate >= 60) return 'text-bull';
  if (rate <= 40) return 'text-bear';
  return 'text-yellow-400';
}

function SignalTable({ rows, meta, title, note }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-slate-300 font-semibold mb-1">{title}</h3>
      {note && <p className="text-xs text-slate-600 mb-3">{note}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs text-slate-500 uppercase tracking-wider pb-2 pr-4">Signal</th>
              <th className="text-right text-xs text-slate-500 uppercase tracking-wider pb-2 px-3">Trades</th>
              <th className="text-right text-xs text-slate-500 uppercase tracking-wider pb-2 px-3">W / L</th>
              <th className="text-right text-xs text-slate-500 uppercase tracking-wider pb-2 px-3">Win Rate</th>
              <th className="text-right text-xs text-slate-500 uppercase tracking-wider pb-2 px-3">Avg P&L</th>
              <th className="text-right text-xs text-slate-500 uppercase tracking-wider pb-2 pl-3">Total P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(row => {
              const m = meta[row.signal] ?? { label: row.signal, color: 'text-slate-400' };
              return (
                <tr key={row.signal} className="hover:bg-slate-800/40 transition-colors">
                  <td className={`py-2.5 pr-4 font-medium ${m.color}`}>
                    {m.label ?? row.signal}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">{row.count}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-xs">
                    <span className="text-bull">{row.wins}</span>
                    <span className="text-slate-600"> / </span>
                    <span className="text-bear">{row.losses}</span>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${winRateColor(row.winRate)}`}>
                    {row.winRate}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono ${row.avgPnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {row.avgPnl >= 0 ? '+' : ''}${row.avgPnl.toFixed(2)}
                  </td>
                  <td className={`py-2.5 pl-3 text-right font-mono font-semibold ${row.totalPnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {row.totalPnl >= 0 ? '+' : ''}${row.totalPnl.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const [history,  setHistory]  = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    Promise.all([getEquityHistory(), getSignalAccuracy(), getPortfolioStats()])
      .then(([h, a, s]) => { setHistory(h); setAccuracy(a); setStats(s); })
      .catch(() => setError('Could not load performance data. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  // ─── Equity chart setup ──────────────────────────────────────────────────────

  const chartData = (history ?? []).map(p => ({
    ...p,
    label: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const equities = chartData.map(p => p.equity);
  const startingEquity = equities[0] ?? 10000;
  const latestEquity   = equities[equities.length - 1] ?? startingEquity;
  const isPositive     = latestEquity >= startingEquity;
  const chartColor     = isPositive ? '#22c55e' : '#ef4444';
  const eqMin = equities.length ? Math.min(...equities) : 0;
  const eqMax = equities.length ? Math.max(...equities) : 10000;
  const eqPad = Math.max((eqMax - eqMin) * 0.15, 50);

  const noTrades = !loading && (!history || history.length <= 1);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-200">Performance</h1>
        <p className="text-slate-500 text-sm mt-1">
          How your paper trading decisions have played out over time.
        </p>
      </div>

      {loading && <div className="text-center py-16 text-slate-500">Loading performance data…</div>}
      {error   && <div className="p-5 bg-red-950 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>}

      {!loading && !error && noTrades && (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-slate-400 mb-2">No trades yet</h2>
          <p className="text-slate-600 max-w-sm mx-auto">
            Make some paper trades on the Analyze page and your equity curve
            and signal accuracy breakdown will appear here.
          </p>
        </div>
      )}

      {!loading && !error && !noTrades && (
        <div className="space-y-6">

          {/* Summary stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Trades',  value: stats.totalTrades,    sub: `${stats.closedTrades} closed` },
                {
                  label: 'Win Rate',
                  value: stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—',
                  sub:   `${stats.winCount}W / ${stats.lossCount}L`,
                  color: stats.winRate >= 50 ? 'text-bull' : 'text-bear',
                },
                {
                  label: 'Total P&L',
                  value: stats.closedTrades > 0
                    ? `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`
                    : '—',
                  color: stats.totalPnl >= 0 ? 'text-bull' : 'text-bear',
                  sub:   'realized only',
                },
                {
                  label: 'Current Equity',
                  value: `$${latestEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  color: isPositive ? 'text-bull' : 'text-bear',
                  sub:   `${isPositive ? '+' : ''}$${(latestEquity - startingEquity).toFixed(2)} vs start`,
                },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="card text-center">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className={`font-mono text-xl font-bold ${color ?? 'text-white'}`}>{value}</div>
                  {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Equity curve */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-slate-300 font-semibold">Equity Curve</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Account value at each trade event — cash plus open positions at last trade price
                </p>
              </div>
              <div className={`font-mono text-sm font-bold ${isPositive ? 'text-bull' : 'text-bear'}`}>
                {isPositive ? '+' : ''}${(latestEquity - startingEquity).toFixed(2)}
                {' '}({isPositive ? '+' : ''}{(((latestEquity - startingEquity) / startingEquity) * 100).toFixed(2)}%)
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0}   />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />

                <YAxis
                  domain={[eqMin - eqPad, eqMax + eqPad]}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  width={70}
                />

                <Tooltip content={<EquityTooltip />} />

                <ReferenceLine
                  y={startingEquity}
                  stroke="#475569"
                  strokeDasharray="4 3"
                  label={{ value: 'Start', fill: '#475569', fontSize: 10, position: 'insideTopRight' }}
                />

                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#equityGradient)"
                  dot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: chartColor, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Signal accuracy */}
          {accuracy && accuracy.totalClosedTrades > 0 ? (
            <div className="card space-y-6">
              <div>
                <h2 className="text-slate-300 font-semibold mb-1">Signal Accuracy</h2>
                <p className="text-xs text-slate-500">
                  When you closed a position with these market signals showing, how often did you come out ahead?
                  Based on {accuracy.totalClosedTrades} closed trade{accuracy.totalClosedTrades !== 1 ? 's' : ''}.
                </p>
              </div>

              <SignalTable
                rows={accuracy.rsi}
                meta={RSI_META}
                title="RSI at Time of Sale"
                note="Was the stock overbought or oversold when you chose to exit?"
              />

              {accuracy.sma.length > 0 && (
                <SignalTable
                  rows={accuracy.sma}
                  meta={SMA_META}
                  title="SMA Trend at Time of Sale"
                  note="Were you selling into a trending market or a mixed one?"
                />
              )}

              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-600 italic">
                  📚 A high win rate with a specific signal isn't proof the signal predicts outcomes —
                  small sample sizes skew these numbers heavily. You need 30+ trades per category
                  before patterns become statistically meaningful.
                  Use this as a learning tool, not a trading system.
                </p>
              </div>
            </div>
          ) : (
            accuracy && accuracy.totalClosedTrades === 0 && (
              <div className="card text-center py-8">
                <p className="text-slate-500 text-sm">
                  Signal accuracy data will appear here once you have closed trades (sells with P&L).
                </p>
              </div>
            )
          )}

        </div>
      )}
    </main>
  );
}
