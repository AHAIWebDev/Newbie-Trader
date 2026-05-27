import { useState } from 'react';

/**
 * Trade Confirmation Modal
 *
 * Appears before every buy or sell. The user MUST write their
 * reasoning before the trade executes. This single constraint
 * is the most valuable educational feature in the app.
 *
 * Also snapshots the current AI signals so the journal can
 * show what the market looked like at the moment of each trade.
 *
 * Props:
 *   trade           — { type, symbol, shares, price, total, pnl }
 *   indicators      — current RSI + SMA data
 *   currentAnalysis — Claude's latest analysis result (may be null)
 *   onConfirm       — called with { reasoning, marketContext }
 *   onCancel        — called when user dismisses
 */
export default function TradeModal({
  trade,
  indicators,
  currentAnalysis,
  onConfirm,
  onCancel
}) {
  const [reasoning,    setReasoning]    = useState('');
  const [reasoningErr, setReasoningErr] = useState(false);

  if (!trade) return null;

  const isBuy     = trade.type === 'BUY';
  const accentCls = isBuy ? 'text-bull border-green-800' : 'text-bear border-red-800';
  const btnCls    = isBuy
    ? 'bg-green-800 hover:bg-green-700 text-bull'
    : 'bg-red-900  hover:bg-red-800  text-bear';

  const handleConfirm = () => {
    if (reasoning.trim().length < 10) {
      setReasoningErr(true);
      return;
    }

    // Build a market context snapshot — this is stored permanently with the trade
    const marketContext = {
      rsiValue:     indicators?.rsi14     ?? null,
      rsiSignal:    indicators?.interpretations?.rsi?.signal ?? 'unknown',
      sma20Signal:  indicators?.interpretations?.priceVsSMA20?.signal ?? 'unknown',
      sma50Signal:  indicators?.interpretations?.priceVsSMA50?.signal ?? 'unknown',
      aiConfidence: currentAnalysis?.confidence ?? null,
      aiAnalyzedAt: currentAnalysis?.generatedAt ?? null,
    };

    onConfirm({ reasoning: reasoning.trim(), marketContext });
  };

  // Signal badge colors
  const signalColor = (signal) => ({
    bullish:    'text-bull',
    bearish:    'text-bear',
    overbought: 'text-yellow-400',
    oversold:   'text-blue-400',
    neutral:    'text-slate-400',
    unknown:    'text-slate-600',
  }[signal] ?? 'text-slate-400');

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal panel */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl
                      shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className={`flex items-center justify-between p-5
                         border-b border-slate-700`}>
          <div>
            <h2 className={`text-xl font-bold font-mono ${accentCls}`}>
              {isBuy ? '▲ BUY' : '▼ SELL'} {trade.symbol}
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Before this trade executes, explain your reasoning.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-300 text-xl p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Trade summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Shares', value: trade.shares },
              { label: 'Price',  value: `$${trade.price.toFixed(2)}` },
              { label: isBuy ? 'Total Cost' : 'Proceeds',
                value: `$${trade.total.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label}
                   className="bg-slate-800 rounded-lg p-3 text-center">
                <div className="text-slate-500 text-xs mb-1">{label}</div>
                <div className="font-mono font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* P&L preview for sells */}
          {!isBuy && trade.pnl !== undefined && (
            <div className={`p-3 rounded-lg border text-center
                             ${trade.pnl >= 0
                               ? 'bg-green-950 border-green-800'
                               : 'bg-red-950  border-red-800'}`}>
              <div className="text-xs text-slate-400 mb-1">Realized P&amp;L</div>
              <div className={`font-mono text-xl font-bold
                               ${trade.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
              </div>
            </div>
          )}

          {/* Market context snapshot */}
          {indicators && (
            <div>
              <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Market Signals at Time of Trade
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'RSI',
                    value: indicators.rsi14?.toFixed(1) ?? '—',
                    signal: indicators.interpretations?.rsi?.signal
                  },
                  {
                    label: 'vs SMA20',
                    value: '',
                    signal: indicators.interpretations?.priceVsSMA20?.signal
                  },
                  {
                    label: 'vs SMA50',
                    value: '',
                    signal: indicators.interpretations?.priceVsSMA50?.signal
                  },
                ].map(({ label, value, signal }) => (
                  <div key={label}
                       className="bg-slate-800 rounded-lg p-2.5 text-center">
                    <div className="text-slate-500 text-xs mb-1">{label}</div>
                    {value && (
                      <div className="font-mono text-white text-sm">{value}</div>
                    )}
                    <div className={`text-xs font-semibold capitalize
                                     ${signalColor(signal)}`}>
                      {signal ?? 'unknown'}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI confidence if available */}
              {currentAnalysis?.confidence != null && (
                <div className="mt-2 p-2.5 bg-slate-800 rounded-lg
                                flex items-center justify-between">
                  <span className="text-slate-400 text-xs">
                    AI Confidence (from last analysis)
                  </span>
                  <span className="font-mono font-bold text-white">
                    {currentAnalysis.confidence}%
                  </span>
                </div>
              )}

              {!currentAnalysis && (
                <p className="text-slate-600 text-xs mt-2 text-center">
                  Tip: run AI Analysis before trading to capture confidence score
                </p>
              )}
            </div>
          )}

          {/* Reasoning — the mandatory field */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
              Why are you making this trade? <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Be specific. Reference the indicators above. This is logged permanently
              so you can review your reasoning vs the actual outcome later.
            </p>
            <textarea
              value={reasoning}
              onChange={(e) => {
                setReasoning(e.target.value);
                if (e.target.value.length >= 10) setReasoningErr(false);
              }}
              placeholder={
                isBuy
                  ? "e.g. Price is above SMA50 suggesting an uptrend. RSI at 58 shows momentum without being overbought. I expect a move toward the recent high over the next week..."
                  : "e.g. Price hit my target, taking profit. Alternatively: stop loss triggered, cutting loss as planned..."
              }
              rows={4}
              className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5
                           text-slate-200 text-sm placeholder-slate-600
                           focus:outline-none focus:border-blue-500 resize-none
                           transition-colors
                           ${reasoningErr ? 'border-red-600' : 'border-slate-600'}`}
            />
            {reasoningErr && (
              <p className="text-red-400 text-xs mt-1">
                Please write at least a sentence explaining your reasoning.
              </p>
            )}
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${
                reasoning.length < 10 ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {reasoning.length} chars
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border border-slate-600 hover:border-slate-400
                         text-slate-400 hover:text-slate-200 rounded-lg
                         transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 py-2.5 font-bold rounded-lg
                           transition-colors text-sm ${btnCls}`}
            >
              Confirm {isBuy ? 'Buy' : 'Sell'}
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-slate-700 text-center">
            Paper trade only · No real money involved
          </p>
        </div>
      </div>
    </div>
  );
}