/**
 * Displays RSI and SMA signals as color-coded badges
 * with plain-English descriptions.
 *
 * EDUCATIONAL: Each indicator has a tooltip-style explanation
 * so you learn what it means every time you see it.
 */

const INDICATOR_DOCS = {
  rsi: {
    name: 'RSI (14)',
    fullName: 'Relative Strength Index',
    description: 'Measures momentum on a 0–100 scale. Above 70 = possibly overbought (overextended gains). Below 30 = possibly oversold (overextended losses). 40–60 = neutral zone.',
  },
  priceVsSMA20: {
    name: 'vs SMA 20',
    fullName: '20-Day Moving Average',
    description: 'The average closing price over the last 20 trading days (~1 month). Price above this line is a short-term bullish sign.',
  },
  priceVsSMA50: {
    name: 'vs SMA 50',
    fullName: '50-Day Moving Average',
    description: 'The average closing price over the last 50 trading days (~2.5 months). A key trend indicator. Price above = medium-term uptrend.',
  },
};

function SignalBadge({ signal }) {
  const classes = {
    bullish:    'badge-bull',
    bearish:    'badge-bear',
    overbought: 'badge-bear',
    oversold:   'badge-bull',
    neutral:    'badge-neutral',
    unknown:    'badge-neutral',
  };
  return (
    <span className={classes[signal] ?? 'badge-neutral'}>
      {signal.toUpperCase()}
    </span>
  );
}

function IndicatorRow({ docKey, value, interpretation }) {
  const doc = INDICATOR_DOCS[docKey];
  return (
    <div className="flex flex-col gap-1.5 p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono font-semibold text-slate-200">{doc.name}</span>
          <span className="ml-2 text-slate-500 text-xs">{doc.fullName}</span>
        </div>
        {value !== null && value !== undefined && (
          <span className="font-mono text-white font-bold">
            {typeof value === 'number' ? value.toFixed(2) : value}
          </span>
        )}
      </div>

      {interpretation && (
        <div className="flex items-start gap-2">
          <SignalBadge signal={interpretation.signal} />
          <p className="text-slate-400 text-sm">{interpretation.description}</p>
        </div>
      )}

      {/* Educational tooltip */}
      <details className="mt-1">
        <summary className="text-xs text-slate-600 hover:text-slate-400 cursor-pointer select-none">
          What is this indicator? ▸
        </summary>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-2 border-l border-slate-700">
          {doc.description}
        </p>
      </details>
    </div>
  );
}

export default function IndicatorPanel({ indicators }) {
  const { sma20, sma50, rsi14, interpretations } = indicators;

  return (
    <div className="card">
      <h2 className="text-slate-300 font-semibold mb-4">Technical Indicators</h2>
      <div className="flex flex-col gap-3">
        <IndicatorRow
          docKey="rsi"
          value={rsi14}
          interpretation={interpretations.rsi}
        />
        <IndicatorRow
          docKey="priceVsSMA20"
          value={sma20}
          interpretation={interpretations.priceVsSMA20}
        />
        <IndicatorRow
          docKey="priceVsSMA50"
          value={sma50}
          interpretation={interpretations.priceVsSMA50}
        />
      </div>
    </div>
  );
}