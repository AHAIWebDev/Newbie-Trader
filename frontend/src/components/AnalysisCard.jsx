import { useState } from 'react';
import { getAnalysis } from '../api/stockApi';

/**
 * The AI analysis card — the centerpiece of the app.
 *
 * Renders Claude's markdown-structured response with:
 * - A confidence meter
 * - Color-coded sections
 * - A "Refresh Analysis" button
 * - Token usage (so you can see what API calls cost)
 */

/**
 * Parse Claude's markdown sections into structured data.
 * Claude reliably returns "### 1. Title\nContent" format
 * because we specify it in the prompt.
 */
function parseAnalysisSections(text) {
  const sections = [];
  // Split on "### N." pattern
  const parts = text.split(/(?=###\s+\d+\.)/);

  for (const part of parts) {
    const titleMatch = part.match(/###\s+\d+\.\s+(.+)/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const content = part
      .replace(/###\s+\d+\.\s+.+\n?/, '')
      .trim();

    sections.push({ title, content });
  }

  return sections;
}

/**
 * Render markdown-ish text to JSX.
 * Handles **bold**, bullet points, and line breaks.
 */
function RenderContent({ text }) {
  const lines = text.split('\n').filter(Boolean);

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Bold text: **text**
        const parts = line.split(/\*\*(.+?)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1
            ? <strong key={j} className="text-slate-200 font-semibold">{part}</strong>
            : <span key={j}>{part}</span>
        );

        // Bullet point
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 text-slate-400 text-sm">
              <span className="text-slate-600 mt-0.5 shrink-0">•</span>
              <span>{rendered}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-slate-400 text-sm leading-relaxed">
            {rendered}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Confidence meter — visual bar from 0–100%.
 * Color-coded: red (< 40), yellow (40–60), green (> 60)
 */
function ConfidenceMeter({ confidence }) {
  if (confidence === null || confidence === undefined) return null;

  const color =
    confidence >= 60 ? 'bg-bull' :
    confidence >= 40 ? 'bg-yellow-400' :
    'bg-bear';

  const label =
    confidence >= 60 ? 'Moderate' :
    confidence >= 40 ? 'Low–Moderate' :
    'Low';

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-300">AI Confidence Score</span>
        <span className="font-mono text-xl font-bold text-white">{confidence}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${color}`}
          style={{
            width: `${confidence}%`,
            boxShadow: confidence >= 60
              ? '0 0 8px rgba(34, 197, 94, 0.6)'
              : confidence >= 40
              ? '0 0 8px rgba(250, 204, 21, 0.6)'
              : '0 0 8px rgba(239, 68, 68, 0.6)'
          }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Confidence: <span className="text-slate-400">{label}</span> —
        Remember: no indicator is a guarantee. Always use a stop loss.
      </p>
    </div>
  );
}

const SECTION_ICONS = {
  'Plain-English Summary': '📋',
  'Indicator Breakdown': '📊',
  'Suggested Stop Loss': '🛑',
  'What Could Go Wrong': '⚠️',
  'Confidence Level': '🎯',
  'One Thing to Learn': '🎓',
};

export default function AnalysisCard({ symbol, onAnalysisComplete }) {
  const [analysis, setAnalysis]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchAnalysis = async (fresh = false) => {
    setLoading(true);
    setError(null);

    // Try up to 2 times before showing an error
    // First attempt may be slow if Polygon cache is cold
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await getAnalysis(symbol, fresh);
        setAnalysis(data);
        setFromCache(data.fromCache);
        onAnalysisComplete?.(data);
        setLoading(false);
        return; // success — exit early
      } catch (err) {
        lastError = err;
        if (attempt === 1) {
          console.log('First analysis attempt failed, retrying...');
          // Brief pause before retry to let any rate limits settle
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // Both attempts failed — show error
    setError(
      lastError.response?.data?.error ??
      lastError.response?.data?.hint ??
      'Analysis timed out. The AI is taking longer than expected — please try again.'
    );
    setLoading(false);
  };

  const sections = analysis ? parseAnalysisSections(analysis.analysis) : [];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-slate-300 font-semibold">AI Analysis</h2>
          <p className="text-slate-600 text-xs mt-0.5">Powered by Claude · Educational use only</p>
        </div>

        {!analysis ? (
          <button
            onClick={() => fetchAnalysis(false)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                       disabled:text-slate-500 text-white text-sm font-semibold
                       rounded-lg transition-colors"
          >
            {loading ? 'Analyzing...' : 'Run AI Analysis'}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {fromCache && (
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                cached
              </span>
            )}
            <button
              onClick={() => fetchAnalysis(true)}
              disabled={loading}
              className="px-3 py-1.5 border border-slate-600 hover:border-slate-400
                         text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
            >
              {loading ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && !analysis && (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="shimmer h-16 w-full" style={{ opacity: 1 - i * 0.15 }} />
          ))}
          <p className="text-slate-600 text-sm text-center pt-2">
            Claude is analyzing {symbol}... this takes 5–10 seconds
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Initial empty state */}
      {!analysis && !loading && !error && (
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-sm">Click "Run AI Analysis" to get Claude's educational breakdown of {symbol}</p>
          <p className="text-xs mt-2 text-slate-700">Uses your Anthropic API key · ~$0.001 per analysis</p>
        </div>
      )}

      {/* Analysis content */}
      {analysis && !loading && (
        <div className="space-y-4">

          <ConfidenceMeter confidence={analysis.confidence} />

          {sections.map((section, i) => (
            <div key={i} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span>{SECTION_ICONS[section.title] ?? '📌'}</span>
                {section.title}
              </h3>
              <RenderContent text={section.content} />
            </div>
          ))}

          {/* Disclaimer + token usage */}
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <p className="text-xs text-slate-600 italic">{analysis.disclaimer}</p>
            <div className="flex justify-between text-xs text-slate-700">
              <span>Model: {analysis.model}</span>
              <span>
                Tokens: {analysis.usage?.inputTokens} in / {analysis.usage?.outputTokens} out
              </span>
              <span>Generated: {new Date(analysis.generatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}