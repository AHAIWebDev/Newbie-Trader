import { useState, useEffect } from 'react';
import { getPositionSize } from '../api/stockApi';

/**
 * InputField is defined OUTSIDE PositionSizer so React never
 * unmounts/remounts it on re-render — fixes the cursor jumping bug.
 */
function InputField({ label, field, value, onChange, hint }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg
                     pl-7 pr-3 py-2 text-slate-100 font-mono text-sm
                     focus:outline-none focus:border-blue-500"
          step="0.01"
          min="0"
        />
      </div>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function PositionSizer({ symbol, currentPrice, portfolioCash }) {
  const [form, setForm] = useState({
    portfolio:   '10000',
    entry:       '',
    stopLoss:    '',
    riskPercent: '1',
  });
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Sync portfolio cash from the Portfolio component whenever it changes
  useEffect(() => {
    if (portfolioCash !== undefined && portfolioCash !== null) {
      setForm(prev => ({ ...prev, portfolio: portfolioCash.toFixed(2) }));
    }
  }, [portfolioCash]);

  // Sync entry price when a new stock is loaded
  useEffect(() => {
    if (currentPrice) {
      setForm(prev => ({ ...prev, entry: currentPrice.toFixed(2), stopLoss: '' }));
      setResult(null);
    }
  }, [currentPrice, symbol]);

  // Stable onChange handler — field name passed as argument, not closed over
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setResult(null);
    setError('');
  };

  const suggestStopLoss = () => {
    if (form.entry) {
      const suggested = (parseFloat(form.entry) * 0.95).toFixed(2);
      setForm(prev => ({ ...prev, stopLoss: suggested }));
    }
  };

  const calculate = async () => {
    if (!form.portfolio || !form.entry || !form.stopLoss) {
      setError('Please fill in all fields');
      return;
    }
    if (parseFloat(form.stopLoss) >= parseFloat(form.entry)) {
      setError('Stop loss must be below entry price');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await getPositionSize(symbol, {
        portfolio:   form.portfolio,
        entry:       form.entry,
        stopLoss:    form.stopLoss,
        riskPercent: form.riskPercent,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-slate-300 font-semibold mb-1">Position Size Calculator</h2>
      <p className="text-xs text-slate-600 mb-4">
        The 1% rule: never risk more than 1% of your portfolio on a single trade.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <InputField
          label="Portfolio Size"
          field="portfolio"
          value={form.portfolio}
          onChange={handleChange}
          hint="Synced from your paper portfolio"
        />
        <InputField
          label="Entry Price"
          field="entry"
          value={form.entry}
          onChange={handleChange}
          hint="Price you plan to buy at"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Stop Loss — custom layout for the Suggest button */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500 uppercase tracking-wider">
              Stop Loss Price
            </label>
            <button
              onClick={suggestStopLoss}
              className="text-xs text-blue-500 hover:text-blue-400"
            >
              Suggest (−5%)
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <input
              type="number"
              value={form.stopLoss}
              onChange={(e) => handleChange('stopLoss', e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg
                         pl-7 pr-3 py-2 text-slate-100 font-mono text-sm
                         focus:outline-none focus:border-blue-500"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-slate-600 mt-1">Exit price if trade goes wrong</p>
        </div>

        {/* Risk % selector */}
        <div>
          <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">
            Risk %
          </label>
          <select
            value={form.riskPercent}
            onChange={(e) => handleChange('riskPercent', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg
                       px-3 py-2 text-slate-100 text-sm
                       focus:outline-none focus:border-blue-500"
          >
            <option value="0.5">0.5% (very conservative)</option>
            <option value="1">1% (recommended)</option>
            <option value="2">2% (aggressive)</option>
          </select>
          <p className="text-xs text-slate-600 mt-1">Max % of portfolio to risk</p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        onClick={calculate}
        disabled={loading}
        className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600
                   disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {loading ? 'Calculating...' : 'Calculate Position Size'}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-emerald-900 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-mono font-bold text-white">
                {result.recommendedShares}
              </div>
              <div className="text-xs text-slate-500">Shares</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-white">
                ${result.totalCost}
              </div>
              <div className="text-xs text-slate-500">Total Cost</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-red-400">
                −${result.maxLoss}
              </div>
              <div className="text-xs text-slate-500">Max Loss</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            {result.explanation}
          </p>
        </div>
      )}
    </div>
  );
}