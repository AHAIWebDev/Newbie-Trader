import { useState } from 'react';

/**
 * Stock symbol search bar.
 *
 * Validates input (letters only, 1-5 chars) before calling onSearch.
 * Shows helpful error message for invalid input.
 */
export default function SearchBar({ onSearch, isLoading }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const symbol = input.trim().toUpperCase().replace(/[^A-Z]/g, '');

    if (!symbol) {
      setError('Please enter a stock symbol');
      return;
    }
    if (symbol.length > 5) {
      setError('Stock symbols are 1–5 letters (e.g. AAPL, MSFT)');
      return;
    }

    setError('');
    onSearch(symbol);
  };

  const handleChange = (e) => {
    // Only allow letters, auto-uppercase
    const val = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
    setInput(val);
    if (error) setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={handleChange}
            placeholder="Enter stock symbol — e.g. AAPL, MSFT, GOOGL"
            maxLength={5}
            className="w-full bg-surface border border-slate-600 rounded-lg px-4 py-3
                       text-slate-100 placeholder-slate-500 font-mono text-lg
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                       transition-colors"
            disabled={isLoading}
          />
          {error && (
            <p className="absolute -bottom-6 left-0 text-sm text-red-400">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !input}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                     disabled:text-slate-500 text-white font-semibold rounded-lg
                     transition-colors min-w-[120px]"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 justify-center">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Loading
            </span>
          ) : 'Analyze'}
        </button>
      </div>
    </form>
  );
}