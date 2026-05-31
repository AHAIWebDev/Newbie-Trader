import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';

/**
 * Price chart with moving average overlays.
 *
 * Uses Recharts AreaChart — a filled line chart that
 * makes trends visually clear at a glance.
 *
 * EDUCATIONAL: Moving averages are plotted as reference lines
 * so you can see how price relates to them over time.
 */
export default function PriceChart({ bars, sma20, sma50 }) {
  if (!bars || bars.length === 0) {
    return (
      <div className="card flex items-center justify-center h-64 text-slate-500">
        No chart data available
      </div>
    );
  }

  // Format bars for Recharts — add label-friendly date
  const chartData = bars.map((bar) => ({
    ...bar,
    // Show only month/day on axis to keep it readable
    label: new Date(bar.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    })
  }));

  const prices = bars.map((b) => b.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.1;

  // Color chart green if ending price > starting price, red otherwise
  const isPositiveTrend = bars[bars.length - 1].close >= bars[0].close;
  const chartColor = isPositiveTrend ? '#22c55e' : '#ef4444';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const bar = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm">
        <div className="font-semibold text-slate-300 mb-2">{label}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
          <span className="text-slate-400">Close</span>
          <span className="text-white">${bar.close.toFixed(2)}</span>
          <span className="text-slate-400">Open</span>
          <span className="text-white">${bar.open.toFixed(2)}</span>
          <span className="text-slate-400">High</span>
          <span className="text-bull">${bar.high.toFixed(2)}</span>
          <span className="text-slate-400">Low</span>
          <span className="text-bear">${bar.low.toFixed(2)}</span>
          <span className="text-slate-400">Volume</span>
          <span className="text-white">{bar.volume?.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-300 font-semibold">Price History (60 days)</h2>
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          {sma20 && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-yellow-400 inline-block"/>
              <span className="text-yellow-400">SMA20 ${sma20}</span>
            </span>
          )}
          {sma50 && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-blue-400 inline-block"/>
              <span className="text-blue-400">SMA50 ${sma50}</span>
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden"
           style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.3) 100%)' }}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={chartColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />

          <XAxis
            dataKey="label"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(chartData.length / 6)}
          />

          <YAxis
            domain={[minPrice - padding, maxPrice + padding]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={55}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* SMA reference lines */}
          {sma20 && (
            <ReferenceLine
              y={sma20}
              stroke="#facc15"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              label={{ value: `SMA20`, fill: '#facc15', fontSize: 10, position: 'insideTopRight' }}
            />
          )}
          {sma50 && (
            <ReferenceLine
              y={sma50}
              stroke="#60a5fa"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              label={{ value: `SMA50`, fill: '#60a5fa', fontSize: 10, position: 'insideBottomRight' }}
            />
          )}

          <Area
            type="monotone"
            dataKey="close"
            stroke={chartColor}
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}