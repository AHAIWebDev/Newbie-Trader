/**
 * Displays company name, symbol, price, and day change.
 *
 * EDUCATIONAL: "Day change" is the difference between
 * today's close and yesterday's open — a quick read
 * on how the market felt about the stock that day.
 */
export default function StockHeader({ stock }) {
  const { company, price, symbol } = stock;

  const dayChange = price.close - price.open;
  const dayChangePct = ((dayChange / price.open) * 100).toFixed(2);
  const isPositive = dayChange >= 0;

  const changeColor = isPositive ? 'text-bull' : 'text-bear';
  const changeSign  = isPositive ? '+' : '';
  const priceGlow   = isPositive
    ? 'drop-shadow-[0_0_12px_rgba(34,197,94,0.4)]'
    : 'drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]';

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        {/* Left: Company info */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl font-mono font-bold text-white">{symbol}</span>
            {company.sector && (
              <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-400">
                {company.sector}
              </span>
            )}
          </div>
          <h1 className="text-slate-300 text-lg">{company.name}</h1>
          {company.description && (
            <p className="text-slate-500 text-sm mt-2 max-w-xl line-clamp-2">
              {company.description}
            </p>
          )}
        </div>

        {/* Right: Price block */}
        <div className="text-right shrink-0">
          <div className={`text-4xl font-mono font-bold text-white ${priceGlow}`}>
            ${price.close.toFixed(2)}
          </div>
          <div className={`text-lg font-mono font-semibold ${changeColor}`}>
            {changeSign}{dayChange.toFixed(2)} ({changeSign}{dayChangePct}%)
          </div>
          <div className="text-slate-500 text-sm mt-1">
            as of {price.date} · prev close
          </div>
        </div>
      </div>

      {/* OHLCV row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-700">
        {[
          { label: 'Open',   value: `$${price.open.toFixed(2)}` },
          { label: 'High',   value: `$${price.high.toFixed(2)}` },
          { label: 'Low',    value: `$${price.low.toFixed(2)}` },
          { label: 'Volume', value: price.volume?.toLocaleString() ?? '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-slate-500 text-xs uppercase tracking-wider">{label}</div>
            <div className="font-mono text-slate-200 mt-1">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}