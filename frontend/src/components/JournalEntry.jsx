import { useState } from 'react';

/**
 * Individual journal entry card.
 * Collapsed by default — expands to show full reasoning
 * and market context snapshot from time of trade.
 *
 * Also allows adding post-trade outcome notes.
 */
export default function JournalEntry({ trade, onUpdateNotes }) {
  const [expanded,     setExpanded]     = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes,        setNotes]        = useState(trade.outcomeNotes ?? '');

  const isBuy   = trade.type === 'BUY';
  const hasPnl  = trade.pnl != null;
  const isWin   = trade.pnl > 0;

  const date = new Date(trade.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const signalColor = (signal) => ({
    bullish:    'text-bull',
    bearish:    'text-bear',
    overbought: 'text-yellow-400',
    oversold:   'text-blue-400',
    neutral:    'text-slate-400',
  }[signal] ?? 'text-slate-500');

  const saveNotes = () => {
    onUpdateNotes(trade.id, notes);
    setEditingNotes(false);
  };

  return (
    <div className={`card transition-all
      ${hasPnl
        ? (isWin ? 'border-green-900' : 'border-red-900')
        : 'border-slate-700'}`}>

      {/* Collapsed header — always visible */}
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Type badge */}
          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded
            ${isBuy
              ? 'bg-green-950 text-bull border border-green-800'
              : 'bg-red-950  text-bear border border-red-800'}`}>
            {trade.type}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white">{trade.symbol}</span>
              <span className="text-slate-500 text-sm">
                {trade.shares} shares @ ${trade.price.toFixed(2)}
              </span>
            </div>
            {/* Reasoning preview */}
            {trade.reasoning && (
              <p className="text-slate-500 text-xs mt-0.5 truncate italic">
                "{trade.reasoning}"
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {/* P&L badge */}
          {hasPnl && (
            <div className={`text-right font-mono text-sm font-bold
              ${isWin ? 'text-bull' : 'text-bear'}`}>
              {isWin ? '+' : ''}${trade.pnl.toFixed(2)}
            </div>
          )}

          {/* AI confidence dot */}
          {trade.marketContext?.aiConfidence != null && (
            <div className="text-xs text-slate-500 hidden sm:block">
              AI: {trade.marketContext.aiConfidence}%
            </div>
          )}

          <div className="text-slate-600 text-xs hidden md:block">{date}</div>

          <span className="text-slate-600 text-xs">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">

          {/* Trade details row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Date',   value: date },
              { label: 'Shares', value: trade.shares },
              { label: 'Price',  value: `$${trade.price.toFixed(2)}` },
              { label: isBuy ? 'Total Cost' : 'Proceeds',
                value: `$${trade.total.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 rounded-lg p-2.5">
                <div className="text-slate-500 text-xs mb-1">{label}</div>
                <div className="font-mono text-white text-sm">{value}</div>
              </div>
            ))}
          </div>

          {/* P&L detail for sells */}
          {hasPnl && (
            <div className={`p-3 rounded-lg border text-center
              ${isWin ? 'bg-green-950 border-green-800'
                      : 'bg-red-950  border-red-800'}`}>
              <div className="text-xs text-slate-400 mb-1">Realized P&amp;L</div>
              <div className={`font-mono text-2xl font-bold
                ${isWin ? 'text-bull' : 'text-bear'}`}>
                {isWin ? '+' : ''}${trade.pnl.toFixed(2)}
                {trade.pnlPct != null && (
                  <span className="text-base ml-2">
                    ({isWin ? '+' : ''}{trade.pnlPct}%)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Market context at time of trade */}
          {trade.marketContext && (
            <div>
              <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Market Conditions at Trade Time
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'RSI',
                    value: trade.marketContext.rsiValue?.toFixed(1) ?? '—',
                    signal: trade.marketContext.rsiSignal },
                  { label: 'vs SMA20',
                    value: '',
                    signal: trade.marketContext.sma20Signal },
                  { label: 'vs SMA50',
                    value: '',
                    signal: trade.marketContext.sma50Signal },
                  { label: 'AI Confidence',
                    value: trade.marketContext.aiConfidence != null
                      ? `${trade.marketContext.aiConfidence}%` : 'Not run',
                    signal: null },
                ].map(({ label, value, signal }) => (
                  <div key={label} className="bg-slate-800 rounded-lg p-2.5">
                    <div className="text-slate-500 text-xs mb-1">{label}</div>
                    {value && (
                      <div className="font-mono text-white text-sm">{value}</div>
                    )}
                    {signal && (
                      <div className={`text-xs font-semibold capitalize
                                       ${signalColor(signal)}`}>
                        {signal}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning — written before the trade */}
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Your Reasoning (written before trade)
            </h4>
            <div className="bg-slate-800 rounded-lg p-3 border-l-2 border-blue-700">
              <p className="text-slate-300 text-sm leading-relaxed italic">
                "{trade.reasoning}"
              </p>
            </div>
          </div>

          {/* Outcome notes — can be added/edited anytime */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-slate-500 uppercase tracking-wider">
                Outcome Notes (add anytime)
              </h4>
              {!editingNotes && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}
                  className="text-xs text-blue-500 hover:text-blue-400"
                >
                  {notes ? 'Edit' : '+ Add notes'}
                </button>
              )}
            </div>

            {editingNotes ? (
              <div onClick={e => e.stopPropagation()}>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Looking back, was your reasoning correct? What did you learn from this trade?"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg
                             px-3 py-2 text-slate-200 text-sm
                             focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={saveNotes}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600
                               text-white text-xs rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setNotes(trade.outcomeNotes ?? ''); setEditingNotes(false); }}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : notes ? (
              <div className="bg-slate-800 rounded-lg p-3 border-l-2 border-slate-600">
                <p className="text-slate-400 text-sm leading-relaxed">{notes}</p>
              </div>
            ) : (
              <p className="text-slate-700 text-xs italic">
                No outcome notes yet. Add them after the trade plays out.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}